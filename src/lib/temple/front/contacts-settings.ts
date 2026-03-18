import { isEqual } from 'lodash';

import {
  TempleAccountType,
  TempleContact,
  TempleContactApiType,
  TempleContactsAccountState,
  TempleSettings
} from 'lib/temple/types';

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

export function getCachedContactsState(
  settings: TempleSettings,
  accountPkh: string
): TempleContactsAccountState | null {
  const state = settings.contactsApi?.accounts?.[accountPkh];
  if (!state) return null;

  return {
    ...state,
    contacts: normalizeContacts(state.contacts)
  };
}

export function getCachedContactsForAccount(settings: TempleSettings, accountPkh: string) {
  return getCachedContactsState(settings, accountPkh)?.contacts ?? [];
}

export function getStoredContactsRecordId(settings: TempleSettings, accountPkh: string) {
  return getCachedContactsState(settings, accountPkh)?.recordId ?? null;
}

export function getStoredContactsTypesByAddress(settings: TempleSettings, accountPkh: string) {
  return getCachedContactsState(settings, accountPkh)?.typesByAddress;
}

export function getCurrentAccountStoredContacts(settings: TempleSettings, accountPkh: string) {
  const cachedContacts = getCachedContactsState(settings, accountPkh)?.contacts;

  if (cachedContacts) {
    return cachedContacts;
  }

  if (settings.contactsApi?.accounts) {
    return [];
  }

  return normalizeContacts(settings.contacts ?? []);
}

export function buildContactsSettingsPatch(
  settings: TempleSettings,
  accountPkh: string,
  contacts: TempleContact[],
  recordId = getStoredContactsRecordId(settings, accountPkh),
  typesByAddress = getStoredContactsTypesByAddress(settings, accountPkh)
): Partial<TempleSettings> {
  const normalizedContacts = normalizeContacts(contacts);
  const nextAccounts = { ...(settings.contactsApi?.accounts ?? {}) };
  const normalizedTypesByAddress =
    typesByAddress && Object.keys(typesByAddress).length > 0
      ? Object.entries(typesByAddress).reduce<Record<string, TempleContactApiType>>((acc, [address, type]) => {
          if (normalizedContacts.some(contact => contact.address === address)) {
            acc[address] = type;
          }

          return acc;
        }, {})
      : undefined;

  if (normalizedContacts.length > 0 || recordId) {
    nextAccounts[accountPkh] = recordId
      ? {
          contacts: normalizedContacts,
          recordId,
          ...(normalizedTypesByAddress && Object.keys(normalizedTypesByAddress).length > 0
            ? { typesByAddress: normalizedTypesByAddress }
            : {})
        }
      : {
          contacts: normalizedContacts,
          ...(normalizedTypesByAddress && Object.keys(normalizedTypesByAddress).length > 0
            ? { typesByAddress: normalizedTypesByAddress }
            : {})
        };
  } else {
    delete nextAccounts[accountPkh];
  }

  return {
    contacts: normalizedContacts,
    contactsApi: Object.keys(nextAccounts).length > 0 ? { accounts: nextAccounts } : undefined
  };
}

export function hasContactsSettingsMismatch(settings: TempleSettings, accountPkh: string, contacts: TempleContact[]) {
  const normalizedContacts = normalizeContacts(contacts);

  return (
    !isEqual(normalizeContacts(settings.contacts ?? []), normalizedContacts) ||
    !isEqual(getCachedContactsForAccount(settings, accountPkh), normalizedContacts)
  );
}

export function canUseEncryptedContacts(accountType: TempleAccountType) {
  return accountType !== TempleAccountType.WatchOnly && accountType !== TempleAccountType.ManagedKT;
}
