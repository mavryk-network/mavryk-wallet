import React, { FC, useMemo } from 'react';

import { ShortcutAccountSelectStateProvider } from 'app/hooks/use-account-select-shortcut';
import { usePushNotifications } from 'app/hooks/use-push-notifications';
import { CustomRpcContext } from 'lib/analytics';
import { useWalletReady, useWalletSuspense } from 'lib/store/zustand/wallet.store';

import { NewBlockTriggersProvider } from './chain';
import { ReadyTempleProvider, useNetwork } from './ready';

export const TempleProvider: FC<PropsWithChildren> = ({ children }) => {
  // Not in use
  usePushNotifications();

  // Intercom sync is started at module level in client.ts (before React renders)
  // to avoid a Suspense deadlock with useWalletSuspense().

  return (
    <CustomRpcContext.Provider value={undefined}>
      <ConditionalReadyTemple>{children}</ConditionalReadyTemple>
    </CustomRpcContext.Provider>
  );
};

const ConditionalReadyTemple: FC<PropsWithChildren> = ({ children }) => {
  // Suspend until the wallet store is hydrated from the background service worker.
  useWalletSuspense();
  const ready = useWalletReady();

  return useMemo(
    () =>
      ready ? (
        <ReadyTempleProvider>
          <WalletRpcProvider>
            <NewBlockTriggersProvider>
              <ShortcutAccountSelectStateProvider>{children}</ShortcutAccountSelectStateProvider>
            </NewBlockTriggersProvider>
          </WalletRpcProvider>
        </ReadyTempleProvider>
      ) : (
        <>{children}</>
      ),
    [children, ready]
  );
};

const WalletRpcProvider: FC<PropsWithChildren> = ({ children }) => {
  const network = useNetwork();

  return <CustomRpcContext.Provider value={network.rpcBaseURL}>{children}</CustomRpcContext.Provider>;
};
