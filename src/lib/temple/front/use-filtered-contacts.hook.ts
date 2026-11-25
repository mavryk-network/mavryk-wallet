import { useMemo } from 'react';

import { isEqual } from 'lodash';

import { useMemoWithCompare } from 'lib/ui/hooks';

import { TempleContact } from '../types';

import {
  buildContactsStorageKey,
  ContactsAvailability,
  getCachedContactsState,
  getContactsBookScope,
  getCurrentAccountStoredContacts,
  getStoredContactsTypesByAddress
} from './contacts-settings';
import { useAccount, useAllAccounts, useNetwork, useRelevantAccounts, useSettings } from './ready';

export function useFilteredContacts() {
  const settings = useSettings();
  const account = useAccount();
  const allAccounts = useAllAccounts();
  const network = useNetwork();
  const contactsBookScope = useMemo(
    () => getContactsBookScope(allAccounts, account.publicKeyHash),
    [account.publicKeyHash, allAccounts]
  );
  const contactsStorageKey = useMemo(
    () =>
      contactsBookScope.status === 'available' ? buildContactsStorageKey(contactsBookScope.bookAddr, network.id) : null,
    [contactsBookScope, network.id]
  );
  const cachedState = useMemo(
    () => (contactsStorageKey ? getCachedContactsState(settings, contactsStorageKey) : null),
    [contactsStorageKey, settings]
  );
  const availability = useMemo<ContactsAvailability>(() => {
    if (contactsBookScope.status === 'unavailable') {
      return { status: 'unavailable', reason: contactsBookScope.reason };
    }

    if (cachedState?.syncError) {
      return { status: 'unavailable', reason: cachedState.syncError };
    }

    return { status: 'ready' };
  }, [cachedState?.syncError, contactsBookScope]);
  const contacts = useMemo(() => {
    if (!contactsStorageKey) {
      return [];
    }

    const storedContacts = getCurrentAccountStoredContacts(settings, contactsStorageKey);
    const typesByAddress = getStoredContactsTypesByAddress(settings, contactsStorageKey);

    return storedContacts.map(contact => ({
      ...contact,
      type: typesByAddress?.[contact.address]
    }));
  }, [contactsStorageKey, settings]);

  const accounts = useRelevantAccounts();
  const accountContacts = useMemo<TempleContact[]>(
    () =>
      accounts.map(acc => ({
        address: acc.publicKeyHash,
        name: acc.name,
        accountInWallet: true
      })),
    [accounts]
  );

  const filteredContacts = useMemoWithCompare(
    () =>
      contacts
        ? contacts.filter(({ address }) => !accountContacts.some(accContact => address === accContact.address))
        : [],
    [contacts, accountContacts],
    isEqual
  );
  const availableFilteredContacts = availability.status === 'ready' ? filteredContacts : [];

  const allContacts = useMemo(
    () => [...availableFilteredContacts, ...accountContacts],
    [availableFilteredContacts, accountContacts]
  );

  return {
    availability,
    canMutateContacts: availability.status === 'ready',
    contacts: availableFilteredContacts,
    allContacts,
    outsideWalletContacts: availableFilteredContacts
  };
}
