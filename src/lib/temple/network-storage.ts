import { browser } from 'lib/browser';
import { CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY } from 'lib/constants';

import { TempleContactsAccountState, TempleNetwork, TempleSettings } from './types';

export const NETWORK_ID_STORAGE_KEY = 'network_id';
export const BASENET_NETWORK_ID = 'basenet';
export const LEGACY_ATLASNET_NETWORK_ID = 'atlasnet';
export const LEGACY_ATLASNET_CHAIN_ID = 'NetXUrNc8uioxP8';
export const LEGACY_ATLASNET_RPC_URL = 'https://atlasnet.rpc.mavryk.network';
export const BASENET_RPC_URL = 'https://basenet.rpc.mavryk.network';

const LEGACY_ATLASNET_PENDING_TRANSACTIONS_KEY_SUFFIX = `_${LEGACY_ATLASNET_CHAIN_ID}_pending_transactions`;
const LEGACY_ATLASNET_SCOPED_STORAGE_KEY_PATTERN = /^\[([^\]]+)\]\[atlasnet\](\[refresh\])?$/;

let legacyAtlasnetStorageMigration: Promise<void> | null = null;

export function normalizeNetworkId<T extends string | null | undefined>(networkId: T) {
  return (networkId === LEGACY_ATLASNET_NETWORK_ID ? BASENET_NETWORK_ID : networkId) as T extends string ? string : T;
}

export function normalizeLegacyAtlasnetScopedStorageKey(storageKey: string) {
  return storageKey.replace(LEGACY_ATLASNET_SCOPED_STORAGE_KEY_PATTERN, '[$1][basenet]$2');
}

export function isLegacyAtlasnetScopedStorageKey(storageKey: string) {
  return LEGACY_ATLASNET_SCOPED_STORAGE_KEY_PATTERN.test(storageKey);
}

export function isLegacyAtlasnetPendingTransactionsStorageKey(storageKey: string) {
  return storageKey.endsWith(LEGACY_ATLASNET_PENDING_TRANSACTIONS_KEY_SUFFIX);
}

export function normalizeLegacyAtlasnetNetworkSnapshot(networks: unknown): TempleNetwork[] {
  if (!Array.isArray(networks)) {
    return [];
  }

  return networks.map(network => normalizeLegacyAtlasnetNetwork(network));
}

export function normalizeLegacyAtlasnetContactsSettings(settings: TempleSettings): TempleSettings {
  const accounts = settings.contactsApi?.accounts;

  if (!accounts) {
    return settings;
  }

  let hasChanges = false;
  const nextAccounts: Record<string, TempleContactsAccountState> = {};
  const sortedEntries = Object.entries(accounts).sort(([leftKey], [rightKey]) => {
    return Number(isLegacyAtlasnetScopedStorageKey(leftKey)) - Number(isLegacyAtlasnetScopedStorageKey(rightKey));
  });

  sortedEntries.forEach(([storageKey, state]) => {
    const normalizedStorageKey = normalizeLegacyAtlasnetScopedStorageKey(storageKey);
    hasChanges ||= normalizedStorageKey !== storageKey;
    nextAccounts[normalizedStorageKey] = mergeContactsAccountState(nextAccounts[normalizedStorageKey], state);
  });

  return hasChanges
    ? {
        ...settings,
        contactsApi: {
          accounts: nextAccounts
        }
      }
    : settings;
}

export function migrateLegacyAtlasnetStorage() {
  if (!legacyAtlasnetStorageMigration) {
    legacyAtlasnetStorageMigration = migrateLegacyAtlasnetStorageOnce().catch(error => {
      legacyAtlasnetStorageMigration = null;
      console.error('Failed to migrate legacy Atlasnet storage', error);
    });
  }

  return legacyAtlasnetStorageMigration;
}

async function migrateLegacyAtlasnetStorageOnce() {
  const storageItems = await browser.storage.local.get(null);
  const valuesToSet: Record<string, unknown> = {};
  const keysToRemove = new Set<string>();

  if (storageItems[NETWORK_ID_STORAGE_KEY] === LEGACY_ATLASNET_NETWORK_ID) {
    valuesToSet[NETWORK_ID_STORAGE_KEY] = BASENET_NETWORK_ID;
  }

  const customNetworksSnapshot = storageItems[CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY];
  const normalizedCustomNetworksSnapshot = normalizeLegacyAtlasnetNetworkSnapshot(customNetworksSnapshot);

  if (
    Array.isArray(customNetworksSnapshot) &&
    JSON.stringify(normalizedCustomNetworksSnapshot) !== JSON.stringify(customNetworksSnapshot)
  ) {
    valuesToSet[CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY] = normalizedCustomNetworksSnapshot;
  }

  Object.entries(storageItems).forEach(([storageKey, value]) => {
    if (isLegacyAtlasnetScopedStorageKey(storageKey)) {
      const normalizedStorageKey = normalizeLegacyAtlasnetScopedStorageKey(storageKey);

      if (!(normalizedStorageKey in storageItems) && !(normalizedStorageKey in valuesToSet)) {
        valuesToSet[normalizedStorageKey] = value;
      }

      keysToRemove.add(storageKey);
    }

    if (isLegacyAtlasnetPendingTransactionsStorageKey(storageKey)) {
      keysToRemove.add(storageKey);
    }
  });

  if (Object.keys(valuesToSet).length > 0) {
    await browser.storage.local.set(valuesToSet);
  }

  if (keysToRemove.size > 0) {
    await browser.storage.local.remove(Array.from(keysToRemove));
  }
}

function normalizeLegacyAtlasnetNetwork(network: TempleNetwork): TempleNetwork {
  if (!isTempleNetworkLike(network)) {
    return network;
  }

  const normalizedNetwork = {
    ...network,
    id: network.id === LEGACY_ATLASNET_NETWORK_ID ? BASENET_NETWORK_ID : network.id,
    description: network.description === 'Mavryk Atlasnet' ? 'Mavryk Basenet' : network.description,
    rpcBaseURL: network.rpcBaseURL === LEGACY_ATLASNET_RPC_URL ? BASENET_RPC_URL : network.rpcBaseURL
  };

  return network.name === 'Mavryk Atlasnet' ? { ...normalizedNetwork, name: 'Mavryk Basenet' } : normalizedNetwork;
}

function isTempleNetworkLike(network: TempleNetwork): network is TempleNetwork {
  return Boolean(network && typeof network === 'object');
}

function mergeContactsAccountState(
  currentState: TempleContactsAccountState | undefined,
  incomingState: TempleContactsAccountState
): TempleContactsAccountState {
  const contacts = dedupeContactsByAddress([...(currentState?.contacts ?? []), ...(incomingState.contacts ?? [])]);
  const typesByAddress = {
    ...(incomingState.typesByAddress ?? {}),
    ...(currentState?.typesByAddress ?? {})
  };
  const accountDataKey = currentState?.accountDataKey ?? incomingState.accountDataKey;
  const lastSeenVersion = currentState?.lastSeenVersion ?? incomingState.lastSeenVersion;

  return {
    ...(accountDataKey ? { accountDataKey } : {}),
    contacts,
    ...(lastSeenVersion ? { lastSeenVersion } : {}),
    ...(currentState?.recordId || incomingState.recordId
      ? { recordId: currentState?.recordId ?? incomingState.recordId }
      : {}),
    ...(Object.keys(typesByAddress).length > 0 ? { typesByAddress } : {})
  };
}

function dedupeContactsByAddress(contacts: TempleContactsAccountState['contacts']) {
  const uniqueContacts = new Map<string, TempleContactsAccountState['contacts'][number]>();

  contacts.forEach(contact => {
    if (!uniqueContacts.has(contact.address)) {
      uniqueContacts.set(contact.address, contact);
    }
  });

  return Array.from(uniqueContacts.values());
}
