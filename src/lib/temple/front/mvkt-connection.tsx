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

import { useTempleClient } from './client';
import { useChainId } from './ready';

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
      shouldShutdownConnection.current = false;
      connection.onclose(e => {
        if (!shouldShutdownConnection.current) {
          console.error(e);
          setConnectionReady(false);
          setTimeout(() => initConnection(), 1000);
        }
      });
      setConnectionReady(true);
    } catch (e) {
      console.error(e);
    }
  }, [connection, setConnectionReady]);

  useEffect(() => {
    if (connection) {
      initConnection();

      return () => {
        if (connectionReadyRef.current) {
          shouldShutdownConnection.current = true;
          connection.stop().catch(e => console.error(e));
        }
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
  const { ready } = useTempleClient();

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
