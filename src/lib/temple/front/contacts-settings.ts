import { isEqual } from 'lodash';

import { CONTACTS_ENCRYPTION_VERSION } from 'lib/temple/contacts-crypto';
import {
  ContactsUnavailableReason,
  TempleAccount,
  TempleAccountType,
  TempleContact,
  TempleContactApiType,
  TempleContactsAccountState,
  TempleSettings
} from 'lib/temple/types';
import { getMavrykApiUrl } from 'mavryk/api/urls';

// `[bookAddr][networkId]`, as built by buildContactsStorageKey. A book address never contains `]`.
const CONTACTS_STORAGE_KEY_PATTERN = /^\[([^\]]+)\]\[(.+)\]$/;

export type ContactsBookScope =
  | {
      status: 'available';
      bookAddr: string;
    }
  | {
      status: 'unavailable';
      bookAddr?: string;
      reason: Exclude<ContactsUnavailableReason, 'auth-unavailable' | 'decrypt-failed'>;
    };

export type ContactsAvailability =
  | { status: 'ready' }
  | { status: 'loading' }
  | { status: 'unavailable'; reason: ContactsUnavailableReason };

export type ContactsSettingsAccountPatch = {
  contactsStorageKey: string;
  contacts: TempleContact[];
  recordId?: string | null;
  syncError?: TempleContactsAccountState['syncError'];
  typesByAddress?: Record<string, TempleContactApiType>;
  lastSeenVersion?: string;
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
  return account.type !== TempleAccountType.WatchOnly && account.type !== TempleAccountType.Ledger;
}

export function getContactsBookScope(allAccounts: TempleAccount[], accountPkh: string): ContactsBookScope {
  const account = allAccounts.find(acc => acc.publicKeyHash === accountPkh);

  if (!account) {
    return { status: 'unavailable', reason: 'missing-account' };
  }

  switch (account.type) {
    case TempleAccountType.HD: {
      const bookAccount = allAccounts.find(
        candidate =>
          candidate.type === TempleAccountType.HD && candidate.walletId === account.walletId && candidate.hdIndex === 0
      );

      return bookAccount
        ? { status: 'available', bookAddr: bookAccount.publicKeyHash }
        : { status: 'unavailable', reason: 'missing-account' };
    }

    case TempleAccountType.Imported:
      return { status: 'available', bookAddr: account.publicKeyHash };

    case TempleAccountType.ManagedKT: {
      const ownerAccount = allAccounts.find(acc => acc.publicKeyHash === account.owner);

      return ownerAccount
        ? getContactsBookScope(allAccounts, ownerAccount.publicKeyHash)
        : { status: 'unavailable', reason: 'missing-owner' };
    }

    case TempleAccountType.Ledger:
      return { status: 'unavailable', bookAddr: account.publicKeyHash, reason: 'ledger' };

    case TempleAccountType.WatchOnly:
      return { status: 'unavailable', bookAddr: account.publicKeyHash, reason: 'watch-only' };
  }
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

export function getStoredContactsLastSeenVersion(settings: TempleSettings, contactsStorageKey: string) {
  return getCachedContactsState(settings, contactsStorageKey)?.lastSeenVersion;
}

function parseContactsStorageKey(contactsStorageKey: string) {
  const match = CONTACTS_STORAGE_KEY_PATTERN.exec(contactsStorageKey);

  return match ? { bookAddr: match[1], networkId: match[2] } : null;
}

function isSameContactsRecord(contactsStorageKey: string, otherContactsStorageKey: string) {
  if (contactsStorageKey === otherContactsStorageKey) return true;

  const scope = parseContactsStorageKey(contactsStorageKey);
  const otherScope = parseContactsStorageKey(otherContactsStorageKey);

  return Boolean(
    scope &&
      otherScope &&
      scope.bookAddr === otherScope.bookAddr &&
      getMavrykApiUrl(scope.networkId) === getMavrykApiUrl(otherScope.networkId)
  );
}

/**
 * Legacy formats are read once per remote record, then refused. Local networks without their own API
 * (custom RPCs) share a record with the network their API URL resolves to, so a migration seen under
 * any of them closes the latch for all of them.
 * The latch is per-device: a fresh install or second device accepts legacy formats until it has seen a
 * current-format record. Accepted residual risk; legacy public-key formats will be removed in a later release.
 */
export function canReadLegacyContacts(settings: TempleSettings, contactsStorageKey: string) {
  return !Object.entries(settings.contactsApi?.accounts ?? {}).some(
    ([storageKey, state]) =>
      state.lastSeenVersion === CONTACTS_ENCRYPTION_VERSION && isSameContactsRecord(contactsStorageKey, storageKey)
  );
}

/**
 * The version to latch after fetching or saving the remote record. Only a record in the current format closes the
 * legacy-read latch; a 404 / empty record leaves it open so a legacy record seen later is still migrated.
 */
export function getContactsLastSeenVersion(state: { encryptionVersion?: string }) {
  return state.encryptionVersion === CONTACTS_ENCRYPTION_VERSION ? CONTACTS_ENCRYPTION_VERSION : undefined;
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
  syncError?: TempleContactsAccountState['syncError'],
  lastSeenVersion?: string
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
    contacts: normalizedContacts,
    ...(recordId ? { recordId } : {}),
    ...(syncError ? { syncError } : {}),
    ...(lastSeenVersion ? { lastSeenVersion } : {}),
    ...(normalizedTypesByAddress && Object.keys(normalizedTypesByAddress).length > 0
      ? { typesByAddress: normalizedTypesByAddress }
      : {})
  };
}

function hasContactsAccountStateContent(state: TempleContactsAccountState) {
  return Boolean(
    state.contacts.length ||
      state.recordId ||
      state.syncError ||
      state.lastSeenVersion ||
      (state.typesByAddress && Object.keys(state.typesByAddress).length > 0)
  );
}

export function hasContactsSettingsAccountPatchMismatch(
  settings: TempleSettings,
  { contactsStorageKey, contacts, recordId, syncError, typesByAddress, lastSeenVersion }: ContactsSettingsAccountPatch
) {
  const currentState = getCachedContactsState(settings, contactsStorageKey);
  const resolvedLastSeenVersion =
    lastSeenVersion === undefined ? getStoredContactsLastSeenVersion(settings, contactsStorageKey) : lastSeenVersion;
  const nextState = buildContactsAccountState(contacts, recordId, typesByAddress, syncError, resolvedLastSeenVersion);

  if (!currentState) {
    return hasContactsAccountStateContent(nextState);
  }

  return !isEqual(
    buildContactsAccountState(
      currentState.contacts,
      currentState.recordId,
      currentState.typesByAddress,
      currentState.syncError,
      currentState.lastSeenVersion
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
  syncError?: TempleContactsAccountState['syncError'],
  lastSeenVersion = getStoredContactsLastSeenVersion(settings, contactsStorageKey)
): Partial<TempleSettings> {
  const nextAccounts = { ...(settings.contactsApi?.accounts ?? {}) };
  const nextAccountState = buildContactsAccountState(contacts, recordId, typesByAddress, syncError, lastSeenVersion);

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
  contactsBookScope: ContactsBookScope
): contactsBookScope is Extract<ContactsBookScope, { status: 'available' }> {
  return contactsBookScope.status === 'available';
}
