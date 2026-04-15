import React, {
  createContext,
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  PropsWithChildren
} from 'react';

import { noop } from 'lodash';

import { createWsConnection, MvktHubConnection } from 'lib/apis/mvkt';
import { IS_DEV_ENV } from 'lib/env';
import { useWalletReady } from 'lib/store/zustand/wallet.store';

import { useChainId } from './ready';

const MAX_WS_RETRIES = 8;
const withJitter = (ms: number) => ms + Math.random() * 1000;

interface MvktConnectionContextValue {
  connection: MvktHubConnection | undefined;
  connectionReady: boolean;
}

const DEFAULT_VALUE: MvktConnectionContextValue = {
  connection: undefined,
  connectionReady: false
};

const MvktConnectionContext = createContext<MvktConnectionContextValue>(DEFAULT_VALUE);

export const useMvktConnection = () => useContext(MvktConnectionContext);

const NotReadyClientMvktConnectionProvider: FC<PropsWithChildren> = ({ children }) => (
  <MvktConnectionContext.Provider value={DEFAULT_VALUE}>{children}</MvktConnectionContext.Provider>
);

const ReadyClientMvktConnectionProvider: FC<PropsWithChildren> = ({ children }) => {
  const chainId = useChainId();
  const [connectionReady, setConnectionReadyState] = useState(false);
  const connectionReadyRef = useRef(connectionReady);
  const shouldShutdownConnection = useRef(false);
  const retryCountRef = useRef(0);

  const setConnectionReady = useCallback((newState: boolean) => {
    connectionReadyRef.current = newState;
    setConnectionReadyState(newState);
  }, []);

  const connection = useMemo(() => (chainId ? createWsConnection(chainId) : undefined), [chainId]);

  const initConnection = useCallback(async () => {
    if (!connection) {
      return;
    }

    setConnectionReady(false);
    try {
      await connection.start();
      retryCountRef.current = 0;
      shouldShutdownConnection.current = false;
      connection.onclose(e => {
        if (!shouldShutdownConnection.current && retryCountRef.current < MAX_WS_RETRIES) {
          if (IS_DEV_ENV) console.error('[mvkt-connection] WS closed:', e);
          setConnectionReady(false);
          const delay = withJitter(Math.min(1000 * 2 ** retryCountRef.current, 30_000));
          retryCountRef.current++;
          setTimeout(() => {
            initConnection().catch(() => void 0);
          }, delay);
        }
      });
      setConnectionReady(true);
    } catch (e) {
      if (IS_DEV_ENV) console.error('[mvkt-connection] WS start failed:', e);
      if (!shouldShutdownConnection.current && retryCountRef.current < MAX_WS_RETRIES) {
        const delay = withJitter(Math.min(5000 * 2 ** retryCountRef.current, 60_000));
        retryCountRef.current++;
        setTimeout(() => {
          initConnection().catch(() => void 0);
        }, delay);
      }
    }
  }, [connection, setConnectionReady]);

  useEffect(() => {
    if (connection) {
      retryCountRef.current = 0;
      initConnection();

      return () => {
        retryCountRef.current = 0;
        shouldShutdownConnection.current = true;
        connection.stop().catch(() => void 0);
      };
    }

    return noop;
  }, [connection, initConnection]);

  const contextValue = useMemo(
    () => ({
      connection,
      connectionReady
    }),
    [connection, connectionReady]
  );

  return <MvktConnectionContext.Provider value={contextValue}>{children}</MvktConnectionContext.Provider>;
};

export const MvktConnectionProvider: FC<PropsWithChildren> = ({ children }) => {
  const ready = useWalletReady();

  return useMemo(
    () =>
      ready ? (
        <ReadyClientMvktConnectionProvider>{children}</ReadyClientMvktConnectionProvider>
      ) : (
        <NotReadyClientMvktConnectionProvider>{children}</NotReadyClientMvktConnectionProvider>
      ),
    [children, ready]
  );
};
