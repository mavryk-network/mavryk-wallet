import { MavrykWalletDAppErrorType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import { Runtime } from 'webextension-polyfill';

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

  pendingDAppRequests.set(origin, pending + 1);
  try {
    return await enqueueDApp(async () => {
      // Drop items whose requesting page has gone (tab closed or navigated) before they open a popup.
      if ((relayPort && !intercom.isConnected(relayPort)) || !(await isDAppEnabled())) {
        throw new Error(MavrykWalletDAppErrorType.NotGranted);
      }

      return factory();
    });
  } finally {
    const left = (pendingDAppRequests.get(origin) ?? 1) - 1;
    if (left > 0) pendingDAppRequests.set(origin, left);
    else pendingDAppRequests.delete(origin);
  }
};
