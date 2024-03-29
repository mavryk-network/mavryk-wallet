import { useCallback } from 'react';

import { getMessage } from 'lib/i18n';
import { TempleContact } from 'lib/temple/types';

import { useTempleClient } from './client';
import { useFilteredContacts } from './use-filtered-contacts.hook';

export function useContactsActions() {
  const { updateSettings } = useTempleClient();
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
