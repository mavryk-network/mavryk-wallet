import { useEffect, useMemo, useRef } from 'react';

import { fetchContactsRecord } from 'mavryk/api/contacts';
import { getAuthTokensFromStorage } from 'mavryk/api/storage';

import { TempleAccount, TempleSettings } from '../types';

import { useTempleClient } from './client';
import type { ContactsAccountScope } from './contacts-settings';
import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  getContactsAccountScope,
  getStoredContactsAccountDataKey,
  hasContactsSettingsAccountPatchMismatch
} from './contacts-settings';

type ContactsSyncContext = {
  accountPkh: string;
  networkId: string;
  scopeKey: string;
};

function buildContactsScopeKey(scope: ContactsAccountScope | null) {
  if (!scope) {
    return '';
  }

  return `${scope.storageAddress}:${scope.authAddress}`;
}

export function useContactsSync(
  account: TempleAccount,
  allAccounts: TempleAccount[],
  networkId: string,
  settings: TempleSettings
) {
  const { ensureAuthorized, revealPublicKey, updateSettings } = useTempleClient();

  const settingsRef = useRef(settings);
  const activeContactsAccountScopeRef = useRef<ContactsAccountScope | null>(null);
  const previousSyncContextRef = useRef<ContactsSyncContext | null>(null);
  const activeContactsAccountScope = useMemo(
    () => getContactsAccountScope(allAccounts, account.publicKeyHash),
    [account.publicKeyHash, allAccounts]
  );
  const activeContactsScopeKey = buildContactsScopeKey(activeContactsAccountScope);

  activeContactsAccountScopeRef.current = activeContactsAccountScope;

  // Keep the latest settings available for async sync work without retriggering the fetch logic.
  // No cleanup is needed because this only updates an in-memory ref.
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Sync remote contacts on deterministic account/network triggers.
  // This manages protected account-data requests; cleanup only cancels applying stale async results.
  useEffect(() => {
    const previousSyncContext = previousSyncContextRef.current;
    const syncContext: ContactsSyncContext = {
      accountPkh: account.publicKeyHash,
      networkId,
      scopeKey: activeContactsScopeKey
    };
    const isInitialSync = previousSyncContext === null;
    const hasNetworkChanged = previousSyncContext?.networkId !== networkId;
    const hasAccountChanged = previousSyncContext?.accountPkh !== account.publicKeyHash;
    const hasScopeChanged = previousSyncContext?.scopeKey !== activeContactsScopeKey;

    previousSyncContextRef.current = syncContext;

    if (!activeContactsScopeKey) {
      return;
    }

    const activeScope = activeContactsAccountScopeRef.current;

    if (!activeScope || (!isInitialSync && !hasNetworkChanged && !hasAccountChanged && !hasScopeChanged)) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const contactsStorageKey = buildContactsStorageKey(activeScope.storageAddress, networkId);
      const authContext = { walletAddress: activeScope.authAddress, networkId };
      const accountDataKey = getStoredContactsAccountDataKey(settingsRef.current, contactsStorageKey);

      try {
        await ensureAuthorized(activeScope.authAddress, networkId, false, activeScope.authAddress);
        if (cancelled) return;

        const { accessToken } = await getAuthTokensFromStorage(authContext);

        if (!accessToken) {
          return;
        }

        const publicKey = await revealPublicKey(activeScope.authAddress);
        if (cancelled) return;

        const {
          accountDataKey: nextAccountDataKey,
          contacts,
          recordId,
          typesByAddress
        } = await fetchContactsRecord({
          accountDataKey,
          publicKey,
          authContext
        });
        if (cancelled) return;

        const contactsPatch = {
          accountDataKey: nextAccountDataKey,
          contactsStorageKey,
          contacts,
          recordId,
          typesByAddress
        };

        if (!hasContactsSettingsAccountPatchMismatch(settingsRef.current, contactsPatch)) {
          return;
        }

        await updateSettings(
          buildContactsSettingsPatch(
            settingsRef.current,
            contactsStorageKey,
            contacts,
            recordId,
            typesByAddress,
            nextAccountDataKey
          )
        );
      } catch (error) {
        if (!cancelled) {
          console.error(`Failed to sync contacts for ${activeScope.storageAddress}`, error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account.publicKeyHash, activeContactsScopeKey, ensureAuthorized, networkId, revealPublicKey, updateSettings]);
}
