import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { useMetadataPagination } from 'app/hooks/use-metadata-pagination';
import { deferred } from 'lib/store/zustand/test-support/helpers';
import { requestOwnedUISnapshot, updateOwnedUI, useOwnedUIStatus } from 'lib/store/zustand/ui-client';
import { getSelectedNetworkIdFromStorage, getWalletAddressFromStorage } from 'mavryk/api/storage';

import { loadTokensMetadataStrict } from './fetch';
import { useMetadataFetching, useMetadataQuery } from './use-metadata-query';
import { useMetadataScope } from './use-metadata-scope';

jest.mock('lib/woozie', () => ({ setNavigateSearchParams: jest.fn() }));
jest.mock('./use-owned-metadata', () => ({ useOwnedMetadata: () => ({}) }));
jest.mock('./fetch', () => ({ loadTokensMetadataStrict: jest.fn() }));
jest.mock('mavryk/api', () => ({ fetchWalletTokens: jest.fn(), mapWalletTokensToFetchedMetadataRecord: jest.fn() }));
jest.mock('./use-metadata-scope', () => ({ useMetadataScope: jest.fn() }));
jest.mock('lib/store/zustand/ui-client', () => ({
  requestOwnedUISnapshot: jest.fn(),
  updateOwnedUI: jest.fn(),
  useOwnedUIStatus: jest.fn()
}));
jest.mock('mavryk/api/storage', () => ({
  getSelectedNetworkIdFromStorage: jest.fn(),
  getWalletAddressFromStorage: jest.fn(),
  MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY: 'auth-map'
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('mounts a single batch behind readiness, settles misses without loops and permits custom RPCs', async () => {
  const scope = { account: 'alice', chainId: 'unknown', networkId: 'custom', rpcUrl: 'https://custom.test' };
  (useMetadataScope as jest.Mock).mockReturnValue(scope);
  (useOwnedUIStatus as jest.Mock).mockReturnValue({ isReady: false });
  (getWalletAddressFromStorage as jest.Mock).mockResolvedValue(scope.account);
  (getSelectedNetworkIdFromStorage as jest.Mock).mockResolvedValue(scope.networkId);
  (updateOwnedUI as jest.Mock).mockResolvedValue(undefined);
  (requestOwnedUISnapshot as jest.Mock).mockImplementation(async command => ({
    metadata: { lastReceipt: command.requestId }
  }));
  (loadTokensMetadataStrict as jest.Mock).mockResolvedValue({ KT1test_0: null });
  const client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  const root = createRoot(document.createElement('div'));
  let isFetching = false;
  function Consumer() {
    useMetadataQuery('collectibles', ['KT1test_0']);
    isFetching = useMetadataFetching('collectibles');
    return null;
  }
  const render = () =>
    act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Consumer />
          <Consumer />
        </QueryClientProvider>
      );
      await new Promise(resolve => setTimeout(resolve, 30));
    });
  await render();
  expect(loadTokensMetadataStrict).not.toHaveBeenCalled();
  (useOwnedUIStatus as jest.Mock).mockReturnValue({ isReady: true });
  await render();
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
  });
  expect(loadTokensMetadataStrict).toHaveBeenCalledTimes(1);
  expect(isFetching).toBe(false);
  await render();
  expect(loadTokensMetadataStrict).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  client.clear();
});

it('pagination adopts inputs added during transport and rejects the removed page result', async () => {
  const scope = { account: 'alice', chainId: 'unknown', networkId: 'custom', rpcUrl: 'https://custom.test' };
  (useMetadataScope as jest.Mock).mockReturnValue(scope);
  (getWalletAddressFromStorage as jest.Mock).mockResolvedValue(scope.account);
  (getSelectedNetworkIdFromStorage as jest.Mock).mockResolvedValue(scope.networkId);
  (updateOwnedUI as jest.Mock).mockResolvedValue(undefined);
  (requestOwnedUISnapshot as jest.Mock).mockImplementation(async command => ({
    metadata: { lastReceipt: command.requestId }
  }));
  const first = deferred<Record<string, null>>();
  (loadTokensMetadataStrict as jest.Mock)
    .mockReset()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValue({ KT1new_0: null });
  const client = new QueryClient({ logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } });
  const root = createRoot(document.createElement('div'));
  let input = ['KT1old_0'];
  let result: ReturnType<typeof useMetadataPagination>;
  function Consumer() {
    result = useMetadataPagination('collectibles', input, 0);
    return null;
  }
  const render = () =>
    act(async () => {
      root.render(
        <QueryClientProvider client={client}>
          <Consumer />
        </QueryClientProvider>
      );
      await new Promise(resolve => setTimeout(resolve, 30));
    });
  await render();
  input = ['KT1new_0'];
  await render();
  await act(async () => {
    first.resolve({ KT1old_0: null });
    await new Promise(resolve => setTimeout(resolve, 30));
  });
  expect(result!.slugs).toEqual(['KT1new_0']);
  expect(result!.isLoading).toBe(false);
  expect(loadTokensMetadataStrict).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
  client.clear();
});
