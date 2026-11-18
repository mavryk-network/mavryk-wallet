import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { useMainnetTokensScamlistSelector } from 'app/store/assets/selectors';
import { fetchScamlistTokens } from 'lib/apis/temple/scamlist-tokens';
import { assetsKeys } from 'lib/query-keys';
import { createAssetsStore } from 'lib/store/zustand/assets.store';
import { awaitStoresHydrated } from 'lib/store/zustand/await-stores-hydrated';
import { memoryStorage } from 'lib/store/zustand/test-support/helpers';
import { UISnapshot } from 'lib/store/zustand/ui-owner.contract';

import { syncSecurity } from './sync-security';
import { useSecurityQuery } from './use-security-query';

let mockAssets: ReturnType<typeof createAssetsStore>;
jest.mock('./use-assets-query', () => ({ useAssetsFetching: () => false }));
jest.mock('lib/apis/temple/scamlist-tokens', () => ({ fetchScamlistTokens: jest.fn() }));
jest.mock('lib/apis/temple/whitelist-tokens', () => ({ fetchWhitelistTokens: jest.fn() }));
jest.mock('lib/store/zustand/ui-client', () => ({
  useOwnedUIStatus: () => ({ isReady: true }),
  useOwnedUI: (selector: (snapshot: Pick<UISnapshot, 'assets'>) => unknown) =>
    selector({ assets: mockAssets.getState() })
}));
jest.mock('./sync-security', () => ({
  beginAssetSync: async () => ({ requestKey: 'scamlist', requestId: 'test' }),
  syncSecurity: jest.fn()
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('renders a persisted scam label after cold hydration with offline transport; unknown differs from validated empty', async () => {
  const memory = memoryStorage();
  const previous = createAssetsStore(memory.storage);
  await awaitStoresHydrated(previous);
  previous.persistence
    .prepare(draft => {
      draft.mainnetScamlist = { scam: true };
      draft.isSecurityAdopted = true;
    })
    .commit();
  await previous.persistence.flush();
  await previous.persistence.dispose();
  mockAssets = createAssetsStore(memory.storage);
  await awaitStoresHydrated(mockAssets);
  (fetchScamlistTokens as jest.Mock).mockRejectedValue(new Error('offline'));
  function Consumer() {
    useSecurityQuery('testnet');
    const security = useMainnetTokensScamlistSelector();
    return <div>{security === null ? 'Security unavailable' : security.scam ? 'Scam' : 'No listed label'}</div>;
  }
  const client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  const container = document.createElement('div');
  const root = createRoot(container);
  const render = async () =>
    act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Consumer />
        </QueryClientProvider>
      );
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  await render();
  expect(client.getQueryState(assetsKeys.security('scamlist'))?.status).toBe('error');
  expect(container.textContent).toBe('Scam');
  expect(syncSecurity).not.toHaveBeenCalled();
  mockAssets.persistence
    .prepare(draft => {
      draft.mainnetScamlist = null;
    })
    .commit();
  await render();
  expect(container.textContent).toBe('Security unavailable');
  mockAssets.persistence
    .prepare(draft => {
      draft.mainnetScamlist = {};
    })
    .commit();
  await render();
  expect(container.textContent).toBe('No listed label');
  await act(async () => root.unmount());
  client.clear();
  await mockAssets.persistence.dispose();
});
