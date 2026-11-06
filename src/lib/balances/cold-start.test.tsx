import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { useAllAccountBalancesSelector } from 'app/store/balances/selectors';
import { useMetadataScope } from 'lib/metadata/use-metadata-scope';
import { awaitStoresHydrated } from 'lib/store/zustand/await-stores-hydrated';
import { createBalancesMigration } from 'lib/store/zustand/balances-migration';
import { createBalancesStore } from 'lib/store/zustand/balances.store';
import { memoryStorage } from 'lib/store/zustand/test-support/helpers';
import { useOwnedUI } from 'lib/store/zustand/ui-client';
import { UISnapshot } from 'lib/store/zustand/ui-owner.contract';

import { useBalancesQuery } from './use-balances-query';

jest.mock('lib/apis/tzkt', () => ({
  isKnownChainId: () => true,
  fetchAllAssetsBalancesFromTzkt: async () => {
    throw new Error('offline');
  },
  fetchTezosBalanceFromTzkt: async () => {
    throw new Error('offline');
  }
}));
jest.mock('lib/metadata/use-metadata-scope', () => ({ useMetadataScope: jest.fn() }));
jest.mock('lib/store/zustand/ui-client', () => ({
  useOwnedUI: jest.fn(),
  useOwnedUIStatus: () => ({ isReady: true }),
  updateOwnedUI: async () => undefined
}));
jest.mock('mavryk/api/storage', () => ({ MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY: 'auth' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('renders persisted zero/missing/other-account values after cold restart and offline refresh, with exact source precedence', async () => {
  const memory = memoryStorage({
    'persist:temple-root-task11': {
      balances: {
        balancesAtomic: {
          alice_chain: { data: { mav: '0', legacyToken: '2' }, isLoading: true },
          bob_chain: { data: { mav: '10' } }
        }
      }
    }
  });
  const initial = createBalancesStore(memory.storage);
  await createBalancesMigration({
    balances: initial,
    storage: memory.storage,
    readFallback: async () => null
  }).initialize();
  initial.persistence
    .prepare(draft => {
      draft.scoped[JSON.stringify(['alice', 'chain', 'mainnet', 'rpc'])] = {
        data: { token: '3' },
        revisions: { token: 1 },
        levels: {}
      };
    })
    .commit();
  await initial.persistence.flush();
  const balances = createBalancesStore(memory.storage);
  await awaitStoresHydrated(balances);
  let scope = { account: 'alice', chainId: 'chain', networkId: 'mainnet', rpcUrl: 'rpc' };
  (useMetadataScope as jest.Mock).mockImplementation(() => scope);
  (useOwnedUI as jest.Mock).mockImplementation((selector: (state: Pick<UISnapshot, 'balances'>) => unknown) =>
    selector({ balances: balances.getState() })
  );
  const c = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  const root = createRoot(document.createElement('div'));
  let displayed: Record<string, string> = {};
  let other: Record<string, string> = {};
  function Consumer() {
    displayed = useAllAccountBalancesSelector('alice', 'chain');
    other = useAllAccountBalancesSelector('bob', 'chain');
    useBalancesQuery('alice');
    return null;
  }
  const render = () =>
    act(async () => {
      root.render(
        <QueryClientProvider client={c}>
          <Consumer />
        </QueryClientProvider>
      );
      await new Promise(resolve => setTimeout(resolve, 30));
    });
  await render();
  expect(displayed).toEqual({ mav: '0', legacyToken: '2', token: '3' });
  expect(displayed.missing).toBeUndefined();
  expect(other).toEqual({ mav: '10' });
  scope = { ...scope, rpcUrl: 'other-rpc' };
  await render();
  expect(displayed.token).toBeUndefined();
  expect(displayed.mav).toBe('0'); // Historical provenance is deliberately unknown, never relabelled as this RPC.
  await act(async () => root.unmount());
  c.clear();
});
