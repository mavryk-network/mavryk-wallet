import React, { createContext, FC, useContext, useEffect, useMemo, useState, PropsWithChildren } from 'react';

import { noop } from 'lodash';

import { createWsConnection, TzktHubConnection } from 'lib/apis/tzkt';

import { useTempleClient } from './client';
import { useChainId } from './ready';

interface TzktConnectionContextValue {
  connection: TzktHubConnection | undefined;
  connectionReady: boolean;
}

const DEFAULT_VALUE: TzktConnectionContextValue = {
  connection: undefined,
  connectionReady: false
};

const TzktConnectionContext = createContext<TzktConnectionContextValue>(DEFAULT_VALUE);

export const useTzktConnection = () => useContext(TzktConnectionContext);

const TZKT_RECONNECT_DELAY_MS = 1000;

const NotReadyClientTzktConnectionProvider: FC<PropsWithChildren> = ({ children }) => (
  <TzktConnectionContext.Provider value={DEFAULT_VALUE}>{children}</TzktConnectionContext.Provider>
);

const ReadyClientTzktConnectionProvider: FC<PropsWithChildren> = ({ children }) => {
  const chainId = useChainId();
  const [readyConnection, setReadyConnection] = useState<TzktHubConnection>();

  const connection = useMemo(() => (chainId ? createWsConnection(chainId) : undefined), [chainId]);
  const connectionReady = readyConnection === connection;

  // Owns the external SignalR socket for the selected chain; cleanup clears retries and closes the socket.
  useEffect(() => {
    if (!connection) return noop;

    let isDisposed = false;
    let isStarting = false;
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

    const markConnectionNotReady = () => {
      setReadyConnection(currentConnection => (currentConnection === connection ? undefined : currentConnection));
    };

    const scheduleReconnect = () => {
      if (isDisposed || reconnectTimeout !== undefined) return;

      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = undefined;
        void startConnection();
      }, TZKT_RECONNECT_DELAY_MS);
    };

    async function startConnection() {
      if (isDisposed || isStarting) return;

      isStarting = true;
      markConnectionNotReady();

      try {
        await connection.start();

        if (isDisposed) {
          void connection.stop().catch(e => console.error(e));
          return;
        }

        setReadyConnection(connection);
      } catch (e) {
        if (!isDisposed) {
          console.error(e);
          scheduleReconnect();
        }
      } finally {
        isStarting = false;
      }
    }

    connection.onclose(e => {
      if (isDisposed) return;

      markConnectionNotReady();
      if (e) console.error(e);
      scheduleReconnect();
    });

    void startConnection();

    return () => {
      isDisposed = true;

      if (reconnectTimeout !== undefined) {
        clearTimeout(reconnectTimeout);
      }

      void connection.stop().catch(e => console.error(e));
    };
  }, [connection]);

  const contextValue = useMemo(
    () => ({
      connection,
      connectionReady
    }),
    [connection, connectionReady]
  );

  return <TzktConnectionContext.Provider value={contextValue}>{children}</TzktConnectionContext.Provider>;
};

export const TzktConnectionProvider: FC<PropsWithChildren> = ({ children }) => {
  const { ready } = useTempleClient();

  return useMemo(
    () =>
      ready ? (
        <ReadyClientTzktConnectionProvider>{children}</ReadyClientTzktConnectionProvider>
      ) : (
        <NotReadyClientTzktConnectionProvider>{children}</NotReadyClientTzktConnectionProvider>
      ),
    [children, ready]
  );
};
