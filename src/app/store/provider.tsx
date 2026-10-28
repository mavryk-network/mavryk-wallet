import React, { useEffect, useState } from 'react';

import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { DetailsQueryProvider } from 'lib/asset-details/query-provider';
import { IS_LOAD_PERF_ENABLED, markLoad, useLoadPerfMark } from 'lib/load-perf';
import { initializeOwnedUI, useOwnedUIStatus } from 'lib/store/zustand/ui-client';

import { store, persistor, initializeReduxPersistence } from './index';

export const StoreProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { isReady, error } = useOwnedUIStatus();
  const [storageError, setStorageError] = useState<Error>();
  const initialize = () => {
    setStorageError(undefined);
    void initializeOwnedUI()
      .then(() => markLoad('owner-snapshot'))
      .then(initializeReduxPersistence)
      .then(() => {
        markLoad('redux-read');
        markWhenReduxRehydrated();
      })
      .catch(() => setStorageError(new Error('Wallet data could not be restored. Retry after fixing storage.')));
  };
  // Restore owner data and preflight Redux reads before child startup effects; no component-owned subscription needs cleanup.
  useEffect(initialize, []);
  if (error || storageError)
    return (
      <div role="alert">
        {(error ?? storageError)?.message} <button onClick={initialize}>Retry</button>
      </div>
    );
  if (!isReady) return null;
  return (
    <Provider store={store}>
      <PersistGate persistor={persistor} loading={null}>
        <AppCommittedMark />
        <DetailsQueryProvider>{children}</DetailsQueryProvider>
      </PersistGate>
    </Provider>
  );
};

/** First commit of the app tree below PersistGate; fires only once nothing under the root Suspense is pending. */
const AppCommittedMark = () => {
  useLoadPerfMark('app-committed');
  return null;
};

function markWhenReduxRehydrated() {
  if (!IS_LOAD_PERF_ENABLED) return;
  const check = () => {
    if (!persistor.getState().bootstrapped) return;
    unsubscribe();
    markLoad('redux-rehydrated');
  };
  const unsubscribe = persistor.subscribe(check);
  check();
}
