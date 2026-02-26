import React, { FC, useEffect, useMemo } from 'react';

import { ShortcutAccountSelectStateProvider } from 'app/hooks/use-account-select-shortcut';
import { usePushNotifications } from 'app/hooks/use-push-notifications';
import { CustomRpcContext } from 'lib/analytics';
import { startIntercomSync } from 'lib/store/zustand/intercom-sync';

import { NewBlockTriggersProvider } from './chain';
import { TempleClientProvider, intercom, useTempleClient } from './client';
import { ReadyTempleProvider, useNetwork } from './ready';

export const TempleProvider: FC<PropsWithChildren> = ({ children }) => {
  // Not in use
  usePushNotifications();

  // Start Zustand ↔ Intercom sync (runs in parallel with SWR-based sync)
  useEffect(() => {
    const unsubscribe = startIntercomSync(intercom);
    return unsubscribe;
  }, []);

  return (
    <CustomRpcContext.Provider value={undefined}>
      <TempleClientProvider>
        <ConditionalReadyTemple>{children}</ConditionalReadyTemple>
      </TempleClientProvider>
    </CustomRpcContext.Provider>
  );
};

const ConditionalReadyTemple: FC<PropsWithChildren> = ({ children }) => {
  const { ready } = useTempleClient();

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
