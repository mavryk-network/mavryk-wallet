import { IntercomClient } from 'lib/intercom';
import { TempleMessageType, TempleNotification } from 'lib/temple/types';

import { walletStore } from './wallet.store';

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

  // Subscribe to ongoing state updates
  return intercom.subscribe((msg: TempleNotification) => {
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
}
