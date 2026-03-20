import { useCallback, useEffect, useRef } from 'react';

import { ACCOUNT_NAME_PATTERN } from 'app/defaults';
import { getMessage } from 'lib/i18n';
import { TempleContact } from 'lib/temple/types';
import { fetchContactsRecord, saveContactsRecord } from 'mavryk/api/contacts';

import { isAddressValid } from '../helpers';

import { useTempleClient } from './client';
import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  canUseEncryptedContacts,
  getCachedContactsState,
  getContactsOwnerAddress,
  getStoredContactsRecordId,
  getStoredContactsTypesByAddress,
  normalizeContacts
} from './contacts-settings';
import { useAccount, useAllAccounts, useNetwork, useSettings } from './ready';
import { useFilteredContacts } from './use-filtered-contacts.hook';

export function useContactsActions() {
  const { ensureAuthorized, revealPublicKey, updateSettings } = useTempleClient();
  const account = useAccount();
  const allAccounts = useAllAccounts();
  const network = useNetwork();
  const settings = useSettings();
  const { allContacts } = useFilteredContacts();
  const settingsRef = useRef(settings);
  const contactsOwnerAddress = getContactsOwnerAddress(allAccounts, account.publicKeyHash);
  const contactsStorageKey = buildContactsStorageKey(contactsOwnerAddress, network.id);

  // Keep the latest settings available for contact actions without rebuilding callbacks.
  // No cleanup is needed because this only updates an in-memory ref.
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const loadCurrentContactsState = useCallback(async () => {
    const currentSettings = settingsRef.current;
    const cachedState = getCachedContactsState(currentSettings, contactsStorageKey);

    if (cachedState) {
      return cachedState;
    }

    if (!canUseEncryptedContacts(account.type)) {
      throw new Error('Encrypted contacts are unavailable for this account type');
    }

    await ensureAuthorized(contactsOwnerAddress, network.id);
    const publicKey = await revealPublicKey(contactsOwnerAddress);
    return fetchContactsRecord(publicKey);
  }, [account.type, contactsOwnerAddress, contactsStorageKey, ensureAuthorized, network.id, revealPublicKey]);

  const persistContacts = useCallback(
    async (
      nextContacts: TempleContact[],
      recordId = getStoredContactsRecordId(settingsRef.current, contactsStorageKey),
      typesByAddress = getStoredContactsTypesByAddress(settingsRef.current, contactsStorageKey)
    ) => {
      const normalizedContacts = normalizeContacts(nextContacts);
      let nextRecordId = recordId;
      let nextTypesByAddress = typesByAddress;

      if (normalizedContacts.length > 0 || recordId) {
        if (!canUseEncryptedContacts(account.type)) {
          throw new Error('Encrypted contacts are unavailable for this account type');
        }

        await ensureAuthorized(contactsOwnerAddress, network.id);
        const publicKey = await revealPublicKey(contactsOwnerAddress);
        const saved = await saveContactsRecord({
          contacts: normalizedContacts,
          publicKey,
          recordId,
          typesByAddress
        });

        nextRecordId = saved.recordId;
        nextTypesByAddress = saved.typesByAddress;
      } else {
        nextRecordId = null;
        nextTypesByAddress = undefined;
      }

      await updateSettings(
        buildContactsSettingsPatch(
          settingsRef.current,
          contactsStorageKey,
          normalizedContacts,
          nextRecordId,
          nextTypesByAddress
        )
      );
    },
    [
      account.type,
      contactsOwnerAddress,
      contactsStorageKey,
      ensureAuthorized,
      network.id,
      revealPublicKey,
      updateSettings
    ]
  );

  const mutateContacts = useCallback(
    async (mutator: (sourceContacts: TempleContact[]) => TempleContact[]) => {
      const { contacts: sourceContacts, recordId, typesByAddress } = await loadCurrentContactsState();
      await persistContacts(mutator(sourceContacts), recordId, typesByAddress);
    },
    [loadCurrentContactsState, persistContacts]
  );

  const addContact = useCallback(
    async (cToAdd: TempleContact) => {
      if (allContacts.some(c => c.address === cToAdd.address && c.accountInWallet)) {
        throw new Error(getMessage('contactWithTheSameAddressAlreadyExists'));
      }

      await mutateContacts(sourceContacts => {
        if (sourceContacts.some(c => c.address === cToAdd.address)) {
          throw new Error(getMessage('contactWithTheSameAddressAlreadyExists'));
        }

        return [cToAdd, ...sourceContacts];
      });
    },
    [allContacts, mutateContacts]
  );

  const addMultipleContacts = useCallback(
    async (rawContacts: Partial<TempleContact>[]) => {
      const normalized: TempleContact[] = rawContacts.map((c, i) => {
        const name = c.name?.trim();
        const address = c.address?.trim();

        // Required fields
        if (!name || !address) {
          throw new Error(`Contact #${i + 1}: name or address is missing`);
        }

        // Validate name
        if (!ACCOUNT_NAME_PATTERN.test(name)) {
          throw new Error(`Contact "${name}": invalid name format`);
        }

        // Validate address
        if (!isAddressValid(address)) {
          throw new Error(`Contact "${name}": invalid address`);
        }

        return {
          name,
          address,
          addedAt: Date.now()
        };
      });

      await mutateContacts(sourceContacts => {
        const existing = new Set(
          allContacts
            .filter(contact => contact.accountInWallet)
            .map(contact => contact.address)
            .concat(sourceContacts.map(contact => contact.address))
        );

        const unique = normalized.filter(contact => {
          if (existing.has(contact.address)) return false;
          existing.add(contact.address);
          return true;
        });

        if (!unique.length) {
          throw new Error(getMessage('noNewContactsToAdd'));
        }

        return [...unique, ...sourceContacts];
      });
    },
    [allContacts, mutateContacts]
  );

  const removeContact = useCallback(
    (address: string) => mutateContacts(sourceContacts => sourceContacts.filter(c => c.address !== address)),
    [mutateContacts]
  );

  const getContact = useCallback(
    (address: string) => allContacts.find(c => c.address === address) ?? null,
    [allContacts]
  );

  const editContact = useCallback(
    (address: string, updatedFields: Partial<TempleContact>) =>
      mutateContacts(sourceContacts =>
        sourceContacts.map(c => {
          if (c.address === address) {
            return {
              ...c,
              ...updatedFields
            };
          }

          return c;
        })
      ),
    [mutateContacts]
  );

  return {
    addContact,
    addMultipleContacts,
    removeContact,
    getContact,
    editContact
  };
}

const CONTACT_FIELDS_TO_SEARCH = ['name', 'address'] as const;

export function searchContacts<T extends TempleContact>(contacts: T[], searchValue: string) {
  if (!searchValue) return contacts;

  const loweredSearchValue = searchValue.toLowerCase();
  return contacts.filter(c =>
    CONTACT_FIELDS_TO_SEARCH.some(field => c[field].toLowerCase().includes(loweredSearchValue))
  );
}
