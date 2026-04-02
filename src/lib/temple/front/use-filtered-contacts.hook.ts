import { useEffect, useMemo } from 'react';

import { isEqual } from 'lodash';

import { useMemoWithCompare } from 'lib/ui/hooks';

import { TempleContact } from '../types';

import { useTempleClient } from './client';
import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  getContactsOwnerAddress,
  getCurrentAccountStoredContacts,
  hasContactsSettingsMismatch
} from './contacts-settings';
import { useAccount, useAllAccounts, useNetwork, useRelevantAccounts, useSettings } from './ready';

export function useFilteredContacts() {
  const settings = useSettings();
  const account = useAccount();
  const allAccounts = useAllAccounts();
  const network = useNetwork();
  const contactsStorageKey = useMemo(
    () => buildContactsStorageKey(getContactsOwnerAddress(allAccounts, account.publicKeyHash), network.id),
    [account.publicKeyHash, allAccounts, network.id]
  );
  const contacts = getCurrentAccountStoredContacts(settings, contactsStorageKey);

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

  const { updateSettings } = useTempleClient();

  // Keep the scoped contacts cache aligned with filtered contacts for the active wallet/network view.
  // No cleanup is needed because this is a one-shot settings synchronization.
  useEffect(() => {
    if (!hasContactsSettingsMismatch(settings, contactsStorageKey, filteredContacts)) {
      return;
    }

    void updateSettings(buildContactsSettingsPatch(settings, contactsStorageKey, filteredContacts));
  }, [contactsStorageKey, filteredContacts, settings, updateSettings]);

  return { contacts: filteredContacts, allContacts, outsideWalletContacts: filteredContacts };
}
