import { useEffect, useMemo, useRef } from 'react';

import { fetchContactsRecord } from 'mavryk/api/contacts';

import { TempleAccount, TempleSettings } from '../types';

import { useTempleClient } from './client';
import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  canUseEncryptedContacts,
  getCachedContactsState,
  getContactsOwnerAddress
} from './contacts-settings';

export function useContactsSync(
  account: TempleAccount,
  allAccounts: TempleAccount[],
  networkId: string,
  settings: TempleSettings
) {
  const { ensureAuthorized, revealPublicKey, updateSettings } = useTempleClient();

  const previousNetworkIdRef = useRef<string>();
  const settingsRef = useRef(settings);
  const contactsOwnerAddress = useMemo(
    () => getContactsOwnerAddress(allAccounts, account.publicKeyHash),
    [account.publicKeyHash, allAccounts]
  );
  const contactsStorageKey = useMemo(
    () => (contactsOwnerAddress ? buildContactsStorageKey(contactsOwnerAddress, networkId) : null),
    [contactsOwnerAddress, networkId]
  );

  // Keep the latest settings available for async sync work without retriggering the fetch logic.
  // No cleanup is needed because this only updates an in-memory ref.
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Sync contacts for the selected auth wallet and network.
  // This manages remote contacts fetches; cleanup only cancels applying stale async results.
  useEffect(() => {
    if (!canUseEncryptedContacts(contactsOwnerAddress) || !contactsStorageKey) {
      previousNetworkIdRef.current = networkId;
      return;
    }

    const shouldRefetchOnNetworkSwitch =
      previousNetworkIdRef.current !== undefined && previousNetworkIdRef.current !== networkId;
    previousNetworkIdRef.current = networkId;

    if (getCachedContactsState(settingsRef.current, contactsStorageKey) && !shouldRefetchOnNetworkSwitch) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await ensureAuthorized(contactsOwnerAddress, networkId);
        if (cancelled) return;

        const publicKey = await revealPublicKey(contactsOwnerAddress);
        if (cancelled) return;

        const { contacts, recordId, typesByAddress } = await fetchContactsRecord(publicKey);

        if (cancelled) return;

        await updateSettings(
          buildContactsSettingsPatch(settingsRef.current, contactsStorageKey, contacts, recordId, typesByAddress)
        );
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to sync contacts', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contactsOwnerAddress, contactsStorageKey, ensureAuthorized, networkId, revealPublicKey, updateSettings]);
}
