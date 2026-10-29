import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import browser from 'webextension-polyfill';

import { fetchAllAssetsBalancesFromTzkt, fetchTezosBalanceFromTzkt } from 'lib/apis/tzkt';
import { useMetadataScope } from 'lib/metadata/use-metadata-scope';
import { balancesKeys } from 'lib/query-keys';
import { deferred } from 'lib/store/zustand/test-support/helpers';
import { requestOwnedUISnapshot, updateOwnedUI, useOwnedUIStatus } from 'lib/store/zustand/ui-client';

import { balanceQueryOptions, refreshBalances } from './balance-query';
import { useBalancesQuery } from './use-balances-query';

jest.mock('lib/apis/tzkt', () => ({
  isKnownChainId: (chain: string) => chain === 'chain',
  fetchAllAssetsBalancesFromTzkt: jest.fn(),
  fetchTezosBalanceFromTzkt: jest.fn()
}));
jest.mock('lib/metadata/use-metadata-scope', () => ({ useMetadataScope: jest.fn() }));
jest.mock('lib/store/zustand/ui-client', () => ({
  requestOwnedUISnapshot: jest.fn(),
  updateOwnedUI: jest.fn(),
  useOwnedUIStatus: jest.fn()
}));
jest.mock('mavryk/api/storage', () => ({ MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY: 'auth' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const scope = { account: 'alice', chainId: 'chain', networkId: 'mainnet', rpcUrl: 'rpc' };
const client = () => new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 20));
beforeEach(() => {
  jest.clearAllMocks();
  (useMetadataScope as jest.Mock).mockReturnValue(scope);
  (useOwnedUIStatus as jest.Mock).mockReturnValue({ isReady: true });
  (fetchTezosBalanceFromTzkt as jest.Mock).mockResolvedValue('0');
  (fetchAllAssetsBalancesFromTzkt as jest.Mock).mockResolvedValue({ token: '123' });
  (updateOwnedUI as jest.Mock).mockResolvedValue(undefined);
  (requestOwnedUISnapshot as jest.Mock).mockImplementation(async command => ({
    balances: { lastReceipt: command.requestId }
  }));
});

it('deduplicates mounted account batches, awaits publication and handles account additions during loading', async () => {
  const c = client();
  const root = createRoot(document.createElement('div'));
  const transport = deferred<Record<string, string>>();
  (fetchAllAssetsBalancesFromTzkt as jest.Mock).mockReturnValueOnce(transport.promise);
  let loading = false;
  function Consumer({ account }: { account: string }) {
    loading = useBalancesQuery(account).isLoading;
    return null;
  }
  const render = async (accounts: string[]) =>
    act(async () => {
      root.render(
        <QueryClientProvider client={c}>
          {accounts.map((account, i) => (
            <Consumer key={i} account={account} />
          ))}
        </QueryClientProvider>
      );
      await settle();
    });
  (useOwnedUIStatus as jest.Mock).mockReturnValue({ isReady: false });
  await render(['alice', 'alice']);
  expect(fetchAllAssetsBalancesFromTzkt).not.toHaveBeenCalled();
  (useOwnedUIStatus as jest.Mock).mockReturnValue({ isReady: true });
  await render(['alice', 'alice']);
  await act(settle);
  expect(fetchAllAssetsBalancesFromTzkt).toHaveBeenCalledTimes(1);
  expect(loading).toBe(true);
  await render(['alice', 'alice', 'bob']);
  expect(fetchAllAssetsBalancesFromTzkt).toHaveBeenCalledWith('bob', 'chain');
  const acknowledgement = deferred<unknown>();
  (requestOwnedUISnapshot as jest.Mock).mockImplementationOnce(async command => {
    await acknowledgement.promise;
    return { balances: { lastReceipt: command.requestId } };
  });
  await act(async () => {
    transport.resolve({ token: '0' });
    await settle();
  });
  expect(c.getQueryData(balancesKeys.request(scope, 'tokens'))).toBeUndefined();
  await act(async () => {
    acknowledgement.resolve(undefined);
    await settle();
  });
  expect(c.getQueryData(balancesKeys.request(scope, 'tokens'))).toBe(true);
  expect(requestOwnedUISnapshot).toHaveBeenCalledWith(expect.objectContaining({ records: { token: '0' } }));
  await act(async () => root.unmount());
  c.clear();
});

it('keeps failures observable, retries explicitly, and isolates RPC/network/account keys', async () => {
  const c = client();
  (fetchAllAssetsBalancesFromTzkt as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(c.fetchQuery(balanceQueryOptions(scope, 'tokens'))).rejects.toThrow('offline');
  expect(requestOwnedUISnapshot).not.toHaveBeenCalled();
  await expect(c.fetchQuery(balanceQueryOptions(scope, 'tokens'))).resolves.toBe(true);
  for (const changed of [{ rpcUrl: 'other' }, { networkId: 'basenet' }, { account: 'bob' }]) {
    await c.fetchQuery(balanceQueryOptions({ ...scope, ...changed }, 'tokens'));
  }
  expect(fetchAllAssetsBalancesFromTzkt).toHaveBeenCalledTimes(5);
  c.clear();
});

it('rejects late A→B→A responses and releases its listener/reservation', async () => {
  const c = client();
  const transport = deferred<Record<string, string>>();
  (fetchAllAssetsBalancesFromTzkt as jest.Mock).mockReturnValue(transport.promise);
  const request = c.fetchQuery(balanceQueryOptions(scope, 'tokens'));
  const rejected = expect(request).rejects.toBeDefined();
  await settle();
  const listener = (browser.storage.onChanged.addListener as jest.Mock).mock.calls.slice(-1)[0][0];
  listener({ network_id: {} }, 'local');
  listener({ network_id: {} }, 'local');
  transport.resolve({ token: '9' });
  await rejected;
  expect(requestOwnedUISnapshot).not.toHaveBeenCalled();
  expect(browser.storage.onChanged.removeListener).toHaveBeenCalledWith(listener);
  expect(updateOwnedUI).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'balances-cancel' }));
  c.clear();
});

it('coalesces block/explicit refreshes while an initial request is active', async () => {
  const c = client();
  const { QueryObserver } = await import('@tanstack/react-query');
  const transport = deferred<Record<string, string>>();
  (fetchAllAssetsBalancesFromTzkt as jest.Mock).mockReturnValueOnce(transport.promise);
  const observer = new QueryObserver(c, balanceQueryOptions(scope, 'tokens'));
  const unsubscribe = observer.subscribe(() => undefined);
  await settle();
  const a = refreshBalances(c, scope, 'tokens');
  const b = refreshBalances(c, scope, 'tokens');
  expect(a).toBe(b);
  transport.resolve({ token: '1' });
  await a;
  expect(fetchAllAssetsBalancesFromTzkt).toHaveBeenCalledTimes(2);
  unsubscribe();
  c.clear();
});

it('releases its owner reservation and storage listener when a hanging transport is cancelled', async () => {
  const c = client();
  (fetchAllAssetsBalancesFromTzkt as jest.Mock).mockReturnValue(new Promise(() => undefined));
  const request = c.fetchQuery(balanceQueryOptions(scope, 'tokens'));
  const rejected = expect(request).rejects.toBeDefined();
  await settle();
  const listener = (browser.storage.onChanged.addListener as jest.Mock).mock.calls.slice(-1)[0][0];
  await c.cancelQueries({ queryKey: balancesKeys.request(scope, 'tokens') });
  await rejected;
  await settle();
  expect(browser.storage.onChanged.removeListener).toHaveBeenCalledWith(listener);
  expect(updateOwnedUI).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'balances-cancel' }));
  c.clear();
});
