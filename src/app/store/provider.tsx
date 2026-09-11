import React, { useEffect, useState } from 'react';

import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { initializeOwnedUI, useOwnedUIStatus } from 'lib/store/zustand/ui-client';

import { store, persistor, initializeReduxPersistence } from './index';

export const StoreProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { isReady, error } = useOwnedUIStatus();
  const [storageError, setStorageError] = useState<Error>();
  const initialize = () => {
    setStorageError(undefined);
    void initializeOwnedUI()
      .then(initializeReduxPersistence)
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
        {children}
      </PersistGate>
    </Provider>
  );
};
