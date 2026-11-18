import React from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

import { useTypedSWR } from 'lib/swr';

import { useRawBalance } from './hooks';

jest.mock('app/hooks/use-balances-loading', () => ({ useBalancesLoadingOnce: jest.fn() }));
jest.mock('app/store/balances/selectors', () => ({ useAllAccountBalancesSelector: () => ({ mav: '0' }) }));
jest.mock('lib/apis/tzkt', () => ({ isKnownChainId: () => true }));
jest.mock('lib/metadata', () => ({ useAssetMetadata: jest.fn(), useGetTokenOrGasMetadata: jest.fn() }));
jest.mock('lib/metadata/use-metadata-scope', () => ({
  useMetadataScope: () => ({ account: 'alice', chainId: 'chain', networkId: 'mainnet', rpcUrl: 'rpc' })
}));
jest.mock('./use-balances-query', () => ({ useBalancesQuery: () => ({ isLoading: false }) }));
jest.mock('lib/swr', () => ({ useTypedSWR: jest.fn() }));
jest.mock('lib/temple/front', () => ({
  useAccount: () => ({ publicKeyHash: 'alice' }),
  useTezos: () => ({ rpc: { getRpcUrl: () => 'rpc' }, checksum: 'native' }),
  useChainIdLoading: () => ({ data: 'chain', mutate: jest.fn() }),
  useOnBlock: jest.fn(),
  ReactiveTezosToolkit: class {
    rpc = {};
    checksum = 'custom';
    setPackerProvider() {}
  }
}));
jest.mock('lib/temple/helpers', () => ({ loadFastRpcClient: jest.fn(), michelEncoder: {} }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('disables unused current-account SWR and preserves arbitrary-address/custom-RPC reads and refresh callbacks', async () => {
  const mutate = jest.fn();
  (useTypedSWR as jest.Mock).mockReturnValue({ data: '7', isValidating: false, mutate });
  const c = new QueryClient();
  const root = createRoot(document.createElement('div'));
  let value: ReturnType<typeof useRawBalance> | undefined;
  function Consumer({ address, rpc }: { address: string; rpc?: string }) {
    value = useRawBalance('mav', address, rpc);
    return null;
  }
  const render = (address: string, rpc?: string) =>
    act(async () => {
      root.render(
        <QueryClientProvider client={c}>
          <Consumer address={address} rpc={rpc} />
        </QueryClientProvider>
      );
    });
  await render('alice');
  expect((useTypedSWR as jest.Mock).mock.calls.slice(-1)[0][0]).toBeNull();
  expect(value?.value).toBe('0');
  await render('bob');
  expect((useTypedSWR as jest.Mock).mock.calls.slice(-1)[0][0]).toEqual(['balance', 'native', 'mav', 'bob']);
  expect(value?.value).toBe('7');
  value?.refresh();
  expect(mutate).toHaveBeenCalledTimes(1);
  await render('alice', 'explicit-rpc');
  expect((useTypedSWR as jest.Mock).mock.calls.slice(-1)[0][0]).toEqual(['balance', 'custom', 'mav', 'alice']);
  expect(value?.value).toBe('7');
  await act(async () => root.unmount());
  c.clear();
});
