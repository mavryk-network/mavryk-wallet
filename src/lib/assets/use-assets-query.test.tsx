import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { dispatch } from 'app/store';
import { loadAccountTokens } from 'app/store/assets/utils';
import { useDetailScope } from 'lib/asset-details/use-detail-scope';
import { assetsKeys } from 'lib/query-keys';
import { deferred } from 'lib/store/zustand/test-support/helpers';
import { requestOwnedUISnapshot, updateOwnedUI, useOwnedUIStatus } from 'lib/store/zustand/ui-client';
import { getSelectedNetworkIdFromStorage, getWalletAddressFromStorage } from 'mavryk/api/storage';

import { useAssetsFetching, useAssetsQuery } from './use-assets-query';

jest.mock('app/store', () => ({ dispatch: jest.fn() }));
jest.mock('app/store/assets/utils', () => ({
  loadAccountTokens: jest.fn(),
  loadAccountCollectibles: jest.fn(),
  loadAccountRwas: jest.fn()
}));
jest.mock('lib/apis/tzkt', () => ({ isKnownChainId: (chain: string) => chain === 'chain' }));
jest.mock('lib/asset-details/use-detail-scope', () => ({ useDetailScope: jest.fn() }));
jest.mock('lib/store/zustand/ui-client', () => ({
  useOwnedUIStatus: jest.fn(),
  updateOwnedUI: jest.fn(),
  requestOwnedUISnapshot: jest.fn(),
  getOwnedUISnapshot: () => ({ metadata: { tokensMetadata: {}, collectiblesMetadata: {}, rwasMetadata: {} } })
}));
jest.mock('mavryk/api/storage', () => ({
  getWalletAddressFromStorage: jest.fn(),
  getSelectedNetworkIdFromStorage: jest.fn(),
  MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY: 'auth-map'
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('deduplicates transport, uses fetching without a feedback loop, preserves effects and isolates late scopes', async () => {
  jest.clearAllMocks();
  let scope = { account: 'alice', chainId: 'chain', networkId: 'mainnet' };
  (useDetailScope as jest.Mock).mockImplementation(() => scope);
  (getWalletAddressFromStorage as jest.Mock).mockImplementation(async () => scope.account);
  (getSelectedNetworkIdFromStorage as jest.Mock).mockImplementation(async () => scope.networkId);
  (useOwnedUIStatus as jest.Mock).mockReturnValue({ isReady: false });
  (updateOwnedUI as jest.Mock).mockResolvedValue(undefined);
  const receipt = deferred<unknown>();
  let command: { requestKey: string; requestId: string } | undefined;
  (requestOwnedUISnapshot as jest.Mock).mockImplementation(async value => {
    command = value;
    return receipt.promise;
  });
  const response = {
    slugs: ['KT1test_0'],
    balances: { KT1test_0: '10' },
    newMeta: { KT1test_0: { name: 'Token', symbol: 'TOK', decimals: 0 } }
  };
  (loadAccountTokens as jest.Mock).mockResolvedValue(response);
  const client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  const root = createRoot(document.createElement('div'));
  let isFetching = false;
  function Consumer() {
    useAssetsQuery('tokens');
    isFetching = useAssetsFetching('tokens');
    return null;
  }
  const render = async () =>
    act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Consumer />
          <Consumer />
        </QueryClientProvider>
      );
      await new Promise(resolve => setTimeout(resolve, 30));
    });
  const settle = async () =>
    act(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });
  const key = () => assetsKeys.account('tokens', scope.account, scope.chainId, scope.networkId);
  await render();
  expect(loadAccountTokens).not.toHaveBeenCalled();
  (useOwnedUIStatus as jest.Mock).mockReturnValue({ isReady: true });
  scope = { ...scope, chainId: 'unknown' };
  await render();
  expect(loadAccountTokens).not.toHaveBeenCalled();
  scope = { ...scope, chainId: 'chain' };
  await render();
  await settle();
  expect(loadAccountTokens).toHaveBeenCalledTimes(1);
  expect(isFetching).toBe(true);
  expect(dispatch).not.toHaveBeenCalled();
  expect(client.getQueryData(key())).toBeUndefined();
  expect(command).toMatchObject({
    kind: 'assets-sync',
    value: { account: 'alice', chainId: 'chain', slugs: response.slugs },
    metadata: { KT1test_0: { name: 'Token' } }
  });
  await act(async () => {
    receipt.resolve({ assets: { syncRequests: { [command!.requestKey]: command!.requestId } } });
  });
  await settle();
  expect(isFetching).toBe(false);
  expect(client.getQueryData(key())).toBe(true);
  expect((dispatch as jest.Mock).mock.calls[0][0].payload).toEqual({
    publicKeyHash: 'alice',
    chainId: 'chain',
    balances: response.balances
  });
  (requestOwnedUISnapshot as jest.Mock).mockRejectedValueOnce(new Error('publication failed'));
  const effects = (dispatch as jest.Mock).mock.calls.length;
  await act(async () => {
    await client.invalidateQueries(key());
  });
  expect(client.getQueryState(key())?.status).toBe('error');
  expect(client.getQueryData(key())).toBe(true);
  expect(dispatch).toHaveBeenCalledTimes(effects);
  const late = deferred<typeof response>();
  (loadAccountTokens as jest.Mock).mockReturnValueOnce(late.promise);
  await act(async () => {
    void client.invalidateQueries(key());
  });
  await settle();
  const oldKey = key();
  scope = { ...scope, account: 'bob', networkId: 'basenet' };
  (requestOwnedUISnapshot as jest.Mock).mockImplementation(async value => ({
    assets: { syncRequests: { [value.requestKey]: value.requestId } }
  }));
  await render();
  await settle();
  expect(client.getQueryData(key())).toBe(true);
  const publications = (requestOwnedUISnapshot as jest.Mock).mock.calls.length;
  await act(async () => {
    late.resolve(response);
  });
  await settle();
  expect(requestOwnedUISnapshot).toHaveBeenCalledTimes(publications);
  expect(client.getQueryData(oldKey)).toBe(true);
  await act(async () => root.unmount());
  client.clear();
});
