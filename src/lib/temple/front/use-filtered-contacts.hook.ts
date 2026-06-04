import { useEffect, useMemo } from 'react';

import { isEqual } from 'lodash';

import { useMemoWithCompare } from 'lib/ui/hooks';

import { TempleContact } from '../types';

import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  getContactsOwnerAddress,
  getCurrentAccountStoredContacts,
  hasContactsSettingsMismatch
} from './contacts-settings';
import { useAccount, useAllAccounts, useNetwork, useRelevantAccounts, useSettings } from './ready';
import { useMavrykClient } from './use-mavryk-client';

export function useFilteredContacts() {
  const settings = useSettings();
  const account = useAccount();
  const allAccounts = useAllAccounts();
  const network = useNetwork();
  const contactsOwnerAddress = useMemo(
    () => getContactsOwnerAddress(allAccounts, account.publicKeyHash),
    [account.publicKeyHash, allAccounts]
  );
  const contactsStorageKey = useMemo(
    () => (contactsOwnerAddress ? buildContactsStorageKey(contactsOwnerAddress, network.id) : null),
    [contactsOwnerAddress, network.id]
  );
  const contacts = useMemo(
    () => (contactsStorageKey ? getCurrentAccountStoredContacts(settings, contactsStorageKey) : []),
    [contactsStorageKey, settings]
  );

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

  const allContacts = useMemo(() => [...filteredContacts, ...accountContacts], [filteredContacts, accountContacts]);

  const { updateSettings } = useMavrykClient();
  useEffect(() => {
    if (!contactsStorageKey) {
      return;
    }

    if (!hasContactsSettingsMismatch(settings, contactsStorageKey, filteredContacts)) {
      return;
    }

    void updateSettings(buildContactsSettingsPatch(settings, contactsStorageKey, filteredContacts));
  }, [contactsStorageKey, filteredContacts, settings, updateSettings]);

  return { contacts: filteredContacts, allContacts, outsideWalletContacts: filteredContacts };
}
