import { useCallback } from 'react';

import { ACCOUNT_NAME_PATTERN } from 'app/defaults';
import { getMessage } from 'lib/i18n';
import { TempleContact } from 'lib/temple/types';

import { isAddressValid } from '../helpers';

import { useMavrykClient } from './client';
import { useFilteredContacts } from './use-filtered-contacts.hook';

export function useContactsActions() {
  const { updateSettings } = useMavrykClient();
  const { contacts, allContacts } = useFilteredContacts();

  const addContact = useCallback(
    async (cToAdd: TempleContact) => {
      if (allContacts.some(c => c.address === cToAdd.address)) {
        throw new Error(getMessage('contactWithTheSameAddressAlreadyExists'));
      }

      await updateSettings({
        contacts: [cToAdd, ...contacts]
      });
    },
    [contacts, allContacts, updateSettings]
  );

  const addMultipleContacts = useCallback(
    async (rawContacts: Partial<TempleContact>[]) => {
      const existing = new Set(allContacts.map(c => c.address));

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

      // Remove duplicates (existing + batch)
      const unique = normalized.filter(c => {
        if (existing.has(c.address)) return false;
        existing.add(c.address);
        return true;
      });

      if (!unique.length) {
        throw new Error(getMessage('noNewContactsToAdd'));
      }

      await updateSettings({
        contacts: [...unique, ...contacts]
      });
    },
    [contacts, allContacts, updateSettings]
  );

  const removeContact = useCallback(
    (address: string) =>
      updateSettings({
        contacts: contacts.filter(c => c.address !== address)
      }),
    [contacts, updateSettings]
  );

  const getContact = useCallback(
    (address: string) => allContacts.find(c => c.address === address) ?? null,
    [allContacts]
  );

  const editContact = useCallback(
    (address: string, updatedFields: Partial<TempleContact>) =>
      updateSettings({
        contacts: contacts.map(c => {
          if (c.address === address) {
            return {
              ...c,
              ...updatedFields
            };
          }

          return c;
        })
      }),
    [contacts, updateSettings]
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
