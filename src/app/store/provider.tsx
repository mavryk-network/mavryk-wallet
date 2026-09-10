import React, { useEffect } from 'react';

import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { initializeOwnedUI, useOwnedUIStatus } from 'lib/store/zustand/ui-client';

import { store, persistor } from './index';

export const StoreProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { isReady, error } = useOwnedUIStatus();
  const initialize = () => {
    void initializeOwnedUI()
      .then(() => persistor.persist())
      .catch(() => undefined);
  };
  // Restore durable preferences before Redux rehydration or child startup effects; the client owns its context listener.
  useEffect(initialize, []);
  if (error)
    return (
      <div role="alert">
        {error.message} <button onClick={initialize}>Retry</button>
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
