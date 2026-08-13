import { isEqual } from 'lodash';

import {
  ContactsUnavailableReason,
  TempleAccount,
  TempleAccountType,
  TempleContact,
  TempleContactApiType,
  TempleContactsAccountState,
  TempleSettings
} from 'lib/temple/types';

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
  syncError?: TempleContactsAccountState['syncError']
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
      (state.typesByAddress && Object.keys(state.typesByAddress).length > 0)
  );
}

export function hasContactsSettingsAccountPatchMismatch(
  settings: TempleSettings,
  { contactsStorageKey, contacts, recordId, syncError, typesByAddress }: ContactsSettingsAccountPatch
) {
  const currentState = getCachedContactsState(settings, contactsStorageKey);
  const nextState = buildContactsAccountState(contacts, recordId, typesByAddress, syncError);

  if (!currentState) {
    return hasContactsAccountStateContent(nextState);
  }

  return !isEqual(
    buildContactsAccountState(
      currentState.contacts,
      currentState.recordId,
      currentState.typesByAddress,
      currentState.syncError
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
  syncError?: TempleContactsAccountState['syncError']
): Partial<TempleSettings> {
  const nextAccounts = { ...(settings.contactsApi?.accounts ?? {}) };
  const nextAccountState = buildContactsAccountState(contacts, recordId, typesByAddress, syncError);

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
