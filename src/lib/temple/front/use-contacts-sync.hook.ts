import { useEffect, useMemo, useRef } from 'react';

import { CurrentContactsRecordDecryptionError, fetchContactsRecord, saveContactsRecord } from 'mavryk/api/contacts';
import { getAuthTokensFromStorage } from 'mavryk/api/storage';

import { TempleAccount, TempleSettings } from '../types';

import { useTempleClient } from './client';
import type { ContactsBookScope } from './contacts-settings';
import {
  buildContactsSettingsPatch,
  buildContactsStorageKey,
  getCachedContactsState,
  getContactsBookScope,
  getStoredContactsAccountDataKey,
  hasContactsSettingsAccountPatchMismatch
} from './contacts-settings';

type ContactsSyncContext = {
  accountPkh: string;
  networkId: string;
  scopeKey: string;
};

function buildContactsScopeKey(scope: ContactsBookScope) {
  return scope.status === 'available' ? scope.bookAddr : `unavailable:${scope.reason}:${scope.bookAddr ?? ''}`;
}

export function useContactsSync(
  account: TempleAccount,
  allAccounts: TempleAccount[],
  networkId: string,
  settings: TempleSettings
) {
  const { deriveContactsKey, ensureAuthorized, revealPublicKey, updateSettings } = useTempleClient();

  const settingsRef = useRef(settings);
  const activeContactsBookScopeRef = useRef<ContactsBookScope>({ status: 'unavailable', reason: 'missing-account' });
  const previousSyncContextRef = useRef<ContactsSyncContext | null>(null);
  const activeContactsBookScope = useMemo(
    () => getContactsBookScope(allAccounts, account.publicKeyHash),
    [account.publicKeyHash, allAccounts]
  );
  const activeContactsScopeKey = buildContactsScopeKey(activeContactsBookScope);

  activeContactsBookScopeRef.current = activeContactsBookScope;

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

    const activeScope = activeContactsBookScopeRef.current;

    if (activeScope.status !== 'available') {
      return;
    }

    if (!isInitialSync && !hasNetworkChanged && !hasAccountChanged && !hasScopeChanged) {
      return;
    }

    let cancelled = false;

    void (async () => {
      let updateContactsSyncError: ((syncError: 'auth-unavailable' | 'decrypt-failed') => Promise<void>) | null = null;

      try {
        const derivedContactsKey = await deriveContactsKey(account.publicKeyHash);

        if (cancelled || derivedContactsKey.status !== 'available') {
          return;
        }

        const contactsKey = {
          key: derivedContactsKey.key,
          bookAddr: derivedContactsKey.bookAddr
        };
        const contactsStorageKey = buildContactsStorageKey(derivedContactsKey.bookAddr, networkId);
        const authContext = { walletAddress: derivedContactsKey.bookAddr, networkId };
        const accountDataKey = getStoredContactsAccountDataKey(settingsRef.current, contactsStorageKey);

        updateContactsSyncError = async syncError => {
          const cachedState = getCachedContactsState(settingsRef.current, contactsStorageKey);
          const contactsPatch = {
            contactsStorageKey,
            contacts: cachedState?.contacts ?? [],
            recordId: cachedState?.recordId ?? null,
            syncError,
            typesByAddress: cachedState?.typesByAddress
          };

          if (!hasContactsSettingsAccountPatchMismatch(settingsRef.current, contactsPatch)) {
            return;
          }

          await updateSettings(
            buildContactsSettingsPatch(
              settingsRef.current,
              contactsStorageKey,
              contactsPatch.contacts,
              contactsPatch.recordId,
              contactsPatch.typesByAddress,
              syncError
            )
          );
        };

        await ensureAuthorized(derivedContactsKey.bookAddr, networkId, false, derivedContactsKey.bookAddr);
        if (cancelled) return;

        const { accessToken } = await getAuthTokensFromStorage(authContext);

        if (!accessToken) {
          await updateContactsSyncError('auth-unavailable');
          return;
        }

        const publicKey = await revealPublicKey(derivedContactsKey.bookAddr);
        if (cancelled) return;

        const remoteState = await fetchContactsRecord({
          contactsKey,
          legacyAccountDataKey: accountDataKey,
          legacyPublicKey: publicKey,
          authContext
        });
        if (cancelled) return;

        const syncedState =
          remoteState.shouldReencrypt && remoteState.recordId
            ? await saveContactsRecord({
                contactsKey,
                contacts: remoteState.contacts,
                recordId: remoteState.recordId,
                typesByAddress: remoteState.typesByAddress,
                authContext
              })
            : remoteState;
        if (cancelled) return;

        const contactsPatch = {
          contactsStorageKey,
          contacts: syncedState.contacts,
          recordId: syncedState.recordId,
          typesByAddress: syncedState.typesByAddress
        };

        if (!hasContactsSettingsAccountPatchMismatch(settingsRef.current, contactsPatch)) {
          return;
        }

        await updateSettings(
          buildContactsSettingsPatch(
            settingsRef.current,
            contactsStorageKey,
            syncedState.contacts,
            syncedState.recordId,
            syncedState.typesByAddress
          )
        );
      } catch (error) {
        if (error instanceof CurrentContactsRecordDecryptionError && updateContactsSyncError) {
          await updateContactsSyncError('decrypt-failed');
          return;
        }

        if (!cancelled) {
          console.error(`Failed to sync contacts for ${activeScope.bookAddr}`, error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    account.publicKeyHash,
    activeContactsScopeKey,
    deriveContactsKey,
    ensureAuthorized,
    networkId,
    revealPublicKey,
    updateSettings
  ]);
}
