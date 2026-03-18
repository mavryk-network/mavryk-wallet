import { useEffect, useRef } from 'react';

import { fetchContactsRecord } from 'mavryk/api/contacts';

import { TempleAccount, TempleSettings } from '../types';

import { useTempleClient } from './client';
import { buildContactsSettingsPatch, canUseEncryptedContacts } from './contacts-settings';

export function useContactsSync(account: TempleAccount, settings: TempleSettings) {
  const { revealPublicKey, updateSettings } = useTempleClient();

  const syncedAccountsRef = useRef<Set<string>>(new Set());
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!canUseEncryptedContacts(account.type)) {
      return;
    }

    if (syncedAccountsRef.current.has(account.publicKeyHash)) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const publicKey = await revealPublicKey(account.publicKeyHash);
        if (cancelled) return;

        const { contacts, recordId } = await fetchContactsRecord(publicKey);

        if (cancelled) return;

        syncedAccountsRef.current.add(account.publicKeyHash);

        await updateSettings(
          buildContactsSettingsPatch(settingsRef.current, account.publicKeyHash, contacts, recordId)
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
  }, [account.publicKeyHash, account.type, revealPublicKey, updateSettings]);
}
