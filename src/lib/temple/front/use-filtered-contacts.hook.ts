import { useEffect, useMemo } from 'react';

import { isEqual } from 'lodash';

import { useMemoWithCompare } from 'lib/ui/hooks';

import { TempleContact } from '../types';

import { useTempleClient } from './client';
import {
  buildContactsSettingsPatch,
  getCurrentAccountStoredContacts,
  hasContactsSettingsMismatch
} from './contacts-settings';
import { useAccount, useRelevantAccounts, useSettings } from './ready';

export function useFilteredContacts() {
  const settings = useSettings();
  const account = useAccount();
  const contacts = getCurrentAccountStoredContacts(settings, account.publicKeyHash);

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
  useEffect(() => {
    if (!hasContactsSettingsMismatch(settings, account.publicKeyHash, filteredContacts)) {
      return;
    }

    void updateSettings(buildContactsSettingsPatch(settings, account.publicKeyHash, filteredContacts));
  }, [account.publicKeyHash, filteredContacts, settings, updateSettings]);

  return { contacts: filteredContacts, allContacts, outsideWalletContacts: filteredContacts };
}
