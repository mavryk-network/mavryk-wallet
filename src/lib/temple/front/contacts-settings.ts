import { isEqual } from 'lodash';

import { canAccountSignAuth } from 'lib/temple/helpers';
import {
  TempleAccount,
  TempleAccountType,
  TempleContact,
  TempleContactApiType,
  TempleContactsAccountState,
  TempleSettings
} from 'lib/temple/types';

export type ContactsAccountScope = {
  storageAddress: string;
  authAddress: string;
};

export type ContactsSettingsAccountPatch = {
  accountDataKey?: string | null;
  contactsStorageKey: string;
  contacts: TempleContact[];
  recordId?: string | null;
  typesByAddress?: Record<string, TempleContactApiType>;
};

function normalizeContact(contact: TempleContact): TempleContact | null {
  const name = contact.name.trim();
  const address = contact.address.trim();

  if (!name || !address) {
    return null;
  }

  return typeof contact.addedAt === 'number' ? { name, address, addedAt: contact.addedAt } : { name, address };
}

export function normalizeContacts(contacts: TempleContact[]) {
  const uniqueContacts = new Map<string, TempleContact>();

  contacts.forEach(contact => {
    const normalized = normalizeContact(contact);

    if (normalized && !uniqueContacts.has(normalized.address)) {
      uniqueContacts.set(normalized.address, normalized);
    }
  });

  return Array.from(uniqueContacts.values());
}

export function canAccountUseContacts(account: TempleAccount) {
  return account.type !== TempleAccountType.WatchOnly;
}

export function getContactsAccountScope(allAccounts: TempleAccount[], accountPkh: string): ContactsAccountScope | null {
  const account = allAccounts.find(acc => acc.publicKeyHash === accountPkh);

  if (!account || !canAccountUseContacts(account)) {
    return null;
  }

  if (account.type === TempleAccountType.ManagedKT) {
    const ownerAccount = allAccounts.find(acc => acc.publicKeyHash === account.owner);

    return ownerAccount && canAccountSignAuth(ownerAccount)
      ? { storageAddress: account.publicKeyHash, authAddress: ownerAccount.publicKeyHash }
      : null;
  }

  return canAccountSignAuth(account)
    ? { storageAddress: account.publicKeyHash, authAddress: account.publicKeyHash }
    : null;
}

export function buildContactsStorageKey(walletAddress: string, networkId: string) {
  return `[${walletAddress}][${networkId}]`;
}

export function getCachedContactsState(
  settings: TempleSettings,
  contactsStorageKey: string
): TempleContactsAccountState | null {
  const state = settings.contactsApi?.accounts?.[contactsStorageKey];
  if (!state) return null;

  return {
    ...state,
    contacts: normalizeContacts(state.contacts)
  };
}

export function getCachedContactsForScope(settings: TempleSettings, contactsStorageKey: string) {
  return getCachedContactsState(settings, contactsStorageKey)?.contacts ?? [];
}

export function getStoredContactsRecordId(settings: TempleSettings, contactsStorageKey: string) {
  return getCachedContactsState(settings, contactsStorageKey)?.recordId ?? null;
}

export function getStoredContactsAccountDataKey(settings: TempleSettings, contactsStorageKey: string) {
  return getCachedContactsState(settings, contactsStorageKey)?.accountDataKey ?? null;
}

export function getStoredContactsTypesByAddress(settings: TempleSettings, contactsStorageKey: string) {
  return getCachedContactsState(settings, contactsStorageKey)?.typesByAddress;
}

export function getCurrentAccountStoredContacts(settings: TempleSettings, contactsStorageKey: string) {
  const cachedContacts = getCachedContactsState(settings, contactsStorageKey)?.contacts;

  if (cachedContacts) {
    return cachedContacts;
  }

  if (settings.contactsApi?.accounts) {
    return [];
  }

  return normalizeContacts(settings.contacts ?? []);
}

function buildContactsAccountState(
  contacts: TempleContact[],
  recordId?: string | null,
  typesByAddress?: Record<string, TempleContactApiType>,
  accountDataKey?: string | null
): TempleContactsAccountState {
  const normalizedContacts = normalizeContacts(contacts);
  const normalizedTypesByAddress =
    typesByAddress && Object.keys(typesByAddress).length > 0
      ? Object.entries(typesByAddress).reduce<Record<string, TempleContactApiType>>((acc, [address, type]) => {
          if (normalizedContacts.some(contact => contact.address === address)) {
            acc[address] = type;
          }

          return acc;
        }, {})
      : undefined;

  return {
    ...(accountDataKey ? { accountDataKey } : {}),
    contacts: normalizedContacts,
    ...(recordId ? { recordId } : {}),
    ...(normalizedTypesByAddress && Object.keys(normalizedTypesByAddress).length > 0
      ? { typesByAddress: normalizedTypesByAddress }
      : {})
  };
}

function hasContactsAccountStateContent(state: TempleContactsAccountState) {
  return Boolean(
    state.accountDataKey ||
      state.contacts.length ||
      state.recordId ||
      (state.typesByAddress && Object.keys(state.typesByAddress).length > 0)
  );
}

export function hasContactsSettingsAccountPatchMismatch(
  settings: TempleSettings,
  { accountDataKey, contactsStorageKey, contacts, recordId, typesByAddress }: ContactsSettingsAccountPatch
) {
  const currentState = getCachedContactsState(settings, contactsStorageKey);
  const nextState = buildContactsAccountState(contacts, recordId, typesByAddress, accountDataKey);

  if (!currentState) {
    return hasContactsAccountStateContent(nextState);
  }

  return !isEqual(
    buildContactsAccountState(
      currentState.contacts,
      currentState.recordId,
      currentState.typesByAddress,
      currentState.accountDataKey
    ),
    nextState
  );
}

export function buildContactsSettingsPatch(
  settings: TempleSettings,
  contactsStorageKey: string,
  contacts: TempleContact[],
  recordId = getStoredContactsRecordId(settings, contactsStorageKey),
  typesByAddress = getStoredContactsTypesByAddress(settings, contactsStorageKey),
  accountDataKey = getStoredContactsAccountDataKey(settings, contactsStorageKey)
): Partial<TempleSettings> {
  const nextAccounts = { ...(settings.contactsApi?.accounts ?? {}) };
  const nextAccountState = buildContactsAccountState(contacts, recordId, typesByAddress, accountDataKey);

  nextAccounts[contactsStorageKey] = nextAccountState;

  return {
    contacts: nextAccountState.contacts,
    contactsApi: Object.keys(nextAccounts).length > 0 ? { accounts: nextAccounts } : undefined
  };
}

export function hasContactsSettingsMismatch(
  settings: TempleSettings,
  contactsStorageKey: string,
  contacts: TempleContact[]
) {
  const normalizedContacts = normalizeContacts(contacts);

  return (
    !isEqual(normalizeContacts(settings.contacts ?? []), normalizedContacts) ||
    !isEqual(getCachedContactsForScope(settings, contactsStorageKey), normalizedContacts)
  );
}

export function canUseEncryptedContacts(
  contactsAccountScope: ContactsAccountScope | null
): contactsAccountScope is ContactsAccountScope {
  return Boolean(contactsAccountScope);
}
