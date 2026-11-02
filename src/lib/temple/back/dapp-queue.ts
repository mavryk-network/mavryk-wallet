import { MavrykWalletDAppErrorType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import { Runtime } from 'webextension-polyfill';

import { DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS } from 'lib/temple/request-timeouts';
import { createQueue } from 'lib/utils';

import { intercom } from './defaults';

const MAX_PENDING_DAPP_REQUESTS_PER_ORIGIN = 3;
export const DAPP_TOO_MANY_PENDING_REQUESTS_ERROR = 'TOO_MANY_PENDING_REQUESTS';

export const enqueueDApp = createQueue();
const pendingDAppRequests = new Map<string, number>();

export const enqueueDAppForOrigin = async <T>(
  origin: string,
  factory: () => Promise<T>,
  isDAppEnabled: () => Promise<boolean>,
  relayPort?: Runtime.Port
): Promise<T> => {
  const pending = pendingDAppRequests.get(origin) ?? 0;
  if (pending >= MAX_PENDING_DAPP_REQUESTS_PER_ORIGIN) {
    // Not NotGranted: the dApp should be able to tell "busy, retry later" apart from a user rejection.
    throw new Error(DAPP_TOO_MANY_PENDING_REQUESTS_ERROR);
  }

  // The page's request timeout (DAPP_PAGE_REQUEST_TIMEOUT_MS) budgets one confirmation request for the wait before the
  // prompt opens, so the prompt's auto-decline still lands before the page reports the request as failed.
  const deadline = Date.now() + DAPP_CONFIRMATION_REQUEST_TIMEOUT_MS;
  let isCounted = true;
  let hasStarted = false;
  const stopCounting = () => {
    if (!isCounted) return;
    isCounted = false;
    const left = (pendingDAppRequests.get(origin) ?? 1) - 1;
    if (left > 0) pendingDAppRequests.set(origin, left);
    else pendingDAppRequests.delete(origin);
  };

  pendingDAppRequests.set(origin, pending + 1);
  // A closed tab's queued items are dropped at dequeue; their slots are freed now so a reloaded page can queue again.
  // A prompt already open stays counted until it is answered.
  const stopDisconnectListening =
    relayPort &&
    intercom.onDisconnect(relayPort, () => {
      if (!hasStarted) stopCounting();
    });

  try {
    return await enqueueDApp(async () => {
      // Drop items whose requesting page has gone (tab closed or navigated) or given up before they open a popup.
      if ((relayPort && !intercom.isConnected(relayPort)) || Date.now() > deadline || !(await isDAppEnabled())) {
        throw new Error(MavrykWalletDAppErrorType.NotGranted);
      }

      hasStarted = true;
      return factory();
    });
  } finally {
    stopDisconnectListening?.();
    stopCounting();
  }
};
