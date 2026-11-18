import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { useBalancesLoading } from 'app/hooks/use-balances-loading';
import { useMetadataScope } from 'lib/metadata/use-metadata-scope';
import { requestOwnedUISnapshot } from 'lib/store/zustand/ui-client';
import { useTzktConnection } from 'lib/temple/front';

jest.mock('lib/metadata/use-metadata-scope', () => ({ useMetadataScope: jest.fn() }));
jest.mock('lib/temple/front', () => ({ useTzktConnection: jest.fn() }));
jest.mock('lib/store/zustand/ui-client', () => ({
  useOwnedUIStatus: () => ({ isReady: true }),
  updateOwnedUI: async () => undefined,
  requestOwnedUISnapshot: jest.fn()
}));
jest.mock('mavryk/api/storage', () => ({ MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY: 'auth' }));
jest.mock('lib/apis/tzkt', () => ({
  ...jest.requireActual('lib/apis/tzkt'),
  isKnownChainId: () => true,
  fetchAllAssetsBalancesFromTzkt: () => new Promise(() => undefined),
  fetchTezosBalanceFromTzkt: () => new Promise(() => undefined)
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('publishes queued zero deltas during snapshots, recovers reorgs and cleans/rebinds listeners on reconnect', async () => {
  const handlers = new Map<string, (value: unknown) => void>();
  const connection = {
    on: jest.fn((name: string, callback: (value: unknown) => void) => handlers.set(name, callback)),
    off: jest.fn((name: string) => handlers.delete(name)),
    invoke: jest.fn().mockResolvedValue(undefined)
  };
  const scope = { account: 'alice', chainId: 'chain', networkId: 'mainnet', rpcUrl: 'rpc' };
  (useMetadataScope as jest.Mock).mockReturnValue(scope);
  (useTzktConnection as jest.Mock).mockReturnValue({ connection, connectionReady: true });
  (requestOwnedUISnapshot as jest.Mock).mockImplementation(async command => ({
    balances: { lastReceipt: command.requestId }
  }));
  const c = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  const root = createRoot(document.createElement('div'));
  function Consumer() {
    useBalancesLoading();
    return null;
  }
  const render = () =>
    act(async () => {
      root.render(
        <QueryClientProvider client={c}>
          <Consumer />
        </QueryClientProvider>
      );
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  await render();
  const original = handlers.get('token_balances')!;
  await act(async () => {
    original({
      type: 1,
      state: 20,
      data: [{ account: { address: 'alice' }, token: { contract: { address: 'KT1test' }, tokenId: '0' }, balance: '0' }]
    });
    original({
      type: 1,
      state: 21,
      data: [{ account: { address: 'alice' }, token: { contract: { address: 'KT1test' }, tokenId: '0' }, balance: '2' }]
    });
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(requestOwnedUISnapshot).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'balances-delta', records: { KT1test_0: '0' } })
  );
  expect(requestOwnedUISnapshot).toHaveBeenCalledWith(expect.objectContaining({ records: { KT1test_0: '2' } }));
  await act(async () => {
    original({ type: 2, state: 19 });
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  expect(requestOwnedUISnapshot).toHaveBeenCalledWith(expect.objectContaining({ isReorg: true, level: 19 }));
  (useTzktConnection as jest.Mock).mockReturnValue({ connection, connectionReady: false });
  await render();
  expect(handlers.size).toBe(0);
  const count = (requestOwnedUISnapshot as jest.Mock).mock.calls.length;
  original({ type: 1, state: 30, data: [] });
  (useTzktConnection as jest.Mock).mockReturnValue({ connection, connectionReady: true });
  await render();
  expect(connection.invoke).toHaveBeenCalledTimes(4);
  expect(requestOwnedUISnapshot).toHaveBeenCalledTimes(count);
  await act(async () => root.unmount());
  expect(handlers.size).toBe(0);
  c.clear();
});
