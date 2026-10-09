import React from 'react';

import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { readFileSync } from 'fs';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { initializeOwnedUI, useOwnedUIStatus } from 'lib/store/zustand/ui-client';

import { StoreProvider } from './provider';

import { initializeReduxPersistence } from './index';

jest.mock('lib/store/zustand/ui-client', () => ({ initializeOwnedUI: jest.fn(), useOwnedUIStatus: jest.fn() }));
jest.mock('./index', () => ({
  store: { getState: () => ({}), subscribe: () => () => undefined, dispatch: jest.fn() },
  persistor: { getState: () => ({ bootstrapped: true }), subscribe: () => () => undefined },
  initializeReduxPersistence: jest.fn().mockResolvedValue(undefined)
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('places the real Query provider behind owner/Redux readiness and tears it down on owner failure', async () => {
  const status = useOwnedUIStatus as jest.MockedFunction<typeof useOwnedUIStatus>;
  const initialize = initializeOwnedUI as jest.MockedFunction<typeof initializeOwnedUI>;
  status.mockReturnValue({ isReady: false, error: undefined });
  initialize.mockResolvedValue(undefined);
  const clients: QueryClient[] = [];
  function Consumer() {
    clients.push(useQueryClient());
    return <span>ready</span>;
  }
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Consumer />
      </StoreProvider>
    );
  });
  expect(clients).toHaveLength(0);
  expect(initializeReduxPersistence).toHaveBeenCalledTimes(1);
  status.mockReturnValue({ isReady: true, error: undefined });
  await act(async () => {
    root.render(
      <StoreProvider>
        <Consumer />
      </StoreProvider>
    );
  });
  expect(clients).toHaveLength(1);
  expect(container.textContent).toBe('ready');
  clients[0].setQueryData(['detail'], 'data');
  status.mockReturnValue({ isReady: false, error: new Error('storage failed') });
  await act(async () => {
    root.render(
      <StoreProvider>
        <Consumer />
      </StoreProvider>
    );
  });
  expect(container.textContent).toContain('storage failed');
  expect(clients[0].getQueryCache().getAll()).toHaveLength(0);
  act(() => root.unmount());
});

it('covers every foreground entrypoint and leaves no production detail-action submitter', () => {
  for (const entry of ['popup', 'fullpage', 'confirm']) {
    expect(readFileSync(`src/${entry}.tsx`, 'utf8')).toContain("from 'app/App'");
  }
  expect(readFileSync('src/app/App.tsx', 'utf8')).toContain('<StoreProvider>');
  expect(readFileSync('src/options.tsx', 'utf8')).toContain('<StoreProvider>');
  const epics = readFileSync('src/app/store/root-state.epics.ts', 'utf8');
  expect(epics).not.toMatch(/collectiblesEpics|rwasEpics/);
  for (const file of [
    'src/app/hooks/use-collectibles-details-loading.ts',
    'src/app/hooks/use-rwa-details-loading.ts',
    'src/app/pages/Collectibles/CollectiblePage/index.tsx',
    'src/app/pages/RWAs/RWAPage/index.tsx'
  ])
    expect(readFileSync(file, 'utf8')).not.toMatch(/loadCollectiblesDetailsActions|loadRwasDetailsActions/);
});
