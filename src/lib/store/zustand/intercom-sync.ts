import browser from 'webextension-polyfill';

import { IntercomClient } from 'lib/intercom';
import { TempleMessageType, TempleNotification } from 'lib/temple/types';

import { queryClient } from './query-client';
import { walletStore } from './wallet.store';

/**
 * Query key root segments that are network-dependent.
 * When the active network changes, queries with these roots are cancelled and invalidated.
 * Derived from src/lib/query-keys.ts — update if new network-dependent keys are added.
 */
const NETWORK_DEPENDENT_KEY_ROOTS = new Set([
  'balance',
  'chain-id',
  'delegate',
  'delegate_stats',
  'baker',
  'baking-history',
  'tzdns-address',
  'tzdns-reverse-name',
  'transfer-base-fee',
  'stake-base-fee',
  'delegate-base-fee'
]);

function isNetworkDependentKey(queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === 'string' && NETWORK_DEPENDENT_KEY_ROOTS.has(queryKey[0]);
}

/**
 * Intercom → Zustand sync bridge.
 *
 * Subscribes to Intercom notifications from the background service worker
 * and mirrors state changes into the Zustand wallet store.
 *
 * This runs in parallel with the existing SWR-based sync in TempleClientProvider.
 * Phase 5b: Components switch from useTempleClient() to useWalletStore() selectors,
 *           at which point the SWR sync becomes unnecessary and can be removed.
 *
 * Call `startIntercomSync(intercom)` once at app startup.
 */
export function startIntercomSync(intercom: IntercomClient) {
  // Fetch initial state from background
  intercom
    .request({ type: TempleMessageType.GetStateRequest })
    .then(res => {
      if ('type' in res && res.type === TempleMessageType.GetStateResponse) {
        walletStore.getState().syncState(res.state);
      }
    })
    .catch(err => {
      console.error('[intercom-sync] Failed to fetch initial state:', err);
    });

  // Cancel and invalidate network-dependent queries when the user switches networks.
  // Network selection is stored in browser.storage.local('network_id') — it is NOT part of
  // TempleState, so StateUpdated does not fire on network switch. We must watch storage directly.
  const handleStorageChanged = (changes: Record<string, browser.Storage.StorageChange>, area: string) => {
    if (area === 'local' && 'network_id' in changes) {
      void queryClient.cancelQueries({ predicate: q => isNetworkDependentKey(q.queryKey) });
      void queryClient.invalidateQueries({ predicate: q => isNetworkDependentKey(q.queryKey) });
    }
  };
  browser.storage.onChanged.addListener(handleStorageChanged);

  // Subscribe to ongoing state updates
  const unsubscribeIntercom = intercom.subscribe((msg: TempleNotification) => {
    if (!msg?.type) return;

    const store = walletStore.getState();

    switch (msg.type) {
      case TempleMessageType.StateUpdated:
        // Re-fetch state from background (same as SWR mutate() does)
        intercom
          .request({ type: TempleMessageType.GetStateRequest })
          .then(res => {
            if ('type' in res && res.type === TempleMessageType.GetStateResponse) {
              store.syncState(res.state);
            }
          })
          .catch(err => {
            console.error('[intercom-sync] Failed to re-fetch state:', err);
          });
        break;

      case TempleMessageType.ConfirmationRequested:
        if (msg.id === store.confirmationId) {
          store.setConfirmation({ id: msg.id, payload: msg.payload, error: msg.error });
        }
        break;

      case TempleMessageType.ConfirmationExpired:
        if (msg.id === store.confirmationId) {
          store.resetConfirmation();
        }
        break;
    }
  });

  return () => {
    unsubscribeIntercom();
    browser.storage.onChanged.removeListener(handleStorageChanged);
  };
}
