import { isEqual } from 'lodash';

import { getAuthWalletAddress } from 'lib/temple/helpers';
import {
  TempleAccount,
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

export function getContactsOwnerAddress(allAccounts: TempleAccount[], accountPkh: string) {
  return getAuthWalletAddress(allAccounts, accountPkh);
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

export function buildContactsSettingsPatch(
  settings: TempleSettings,
  contactsStorageKey: string,
  contacts: TempleContact[],
  recordId = getStoredContactsRecordId(settings, contactsStorageKey),
  typesByAddress = getStoredContactsTypesByAddress(settings, contactsStorageKey)
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

  nextAccounts[contactsStorageKey] = {
    contacts: normalizedContacts,
    ...(recordId ? { recordId } : {}),
    ...(normalizedTypesByAddress && Object.keys(normalizedTypesByAddress).length > 0
      ? { typesByAddress: normalizedTypesByAddress }
      : {})
  };

  return {
    contacts: normalizedContacts,
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

export function canUseEncryptedContacts(accountType: TempleAccountType) {
  return accountType !== TempleAccountType.WatchOnly && accountType !== TempleAccountType.ManagedKT;
}
