import { useCallback, useMemo } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { useBalancesLoadingOnce } from 'app/hooks/use-balances-loading';
import { useAllAccountBalancesSelector } from 'app/store/balances/selectors';
import { isKnownChainId } from 'lib/apis/tzkt';
import { useAssetMetadata, useGetTokenOrGasMetadata } from 'lib/metadata';
import { useMetadataScope } from 'lib/metadata/use-metadata-scope';
import { useTypedSWR } from 'lib/swr';
import {
  useTezos,
  useAccount,
  useChainId,
  ReactiveTezosToolkit,
  useChainIdLoading,
  useOnBlock
} from 'lib/temple/front';
import { michelEncoder, loadFastRpcClient, atomsToTokens } from 'lib/temple/helpers';

import { refreshBalances } from './balance-query';
import { fetchRawBalance as fetchRawBalanceFromBlockchain } from './fetch';
import { useBalancesQuery } from './use-balances-query';
import { getBalanceSWRKey } from './utils';

export const useCurrentAccountBalances = () => {
  const { publicKeyHash } = useAccount();
  const chainId = useChainId(true)!;

  return useAllAccountBalancesSelector(publicKeyHash, chainId);
};

export const useOtherAccountBalances = (accountPkh: string) => {
  const chainId = useChainId(true)!;

  return useAllAccountBalancesSelector(accountPkh, chainId);
};

export const useGetCurrentAccountTokenOrGasBalanceWithDecimals = () => {
  const rawBalances = useCurrentAccountBalances();
  const getMetadata = useGetTokenOrGasMetadata();

  return useCallback(
    (slug: string) => {
      const rawBalance = rawBalances[slug] as string | undefined;
      const metadata = getMetadata(slug);

      return rawBalance && metadata ? atomsToTokens(new BigNumber(rawBalance), metadata.decimals) : undefined;
    },
    [rawBalances, getMetadata]
  );
};

export const useGetOtherAccountTokenOrGasBalanceWithDecimals = (accountPkh: string) => {
  const rawBalances = useOtherAccountBalances(accountPkh);
  const getMetadata = useGetTokenOrGasMetadata();

  useBalancesLoadingOnce(accountPkh);

  return useCallback(
    (slug: string) => {
      const rawBalance = rawBalances[slug] as string | undefined;
      const metadata = getMetadata(slug);

      return rawBalance && metadata ? atomsToTokens(new BigNumber(rawBalance), metadata.decimals) : undefined;
    },
    [rawBalances, getMetadata]
  );
};

export function useRawBalance(
  assetSlug: string,
  address: string,
  networkRpc?: string
): {
  value: string | undefined;
  isSyncing: boolean;
  error?: unknown;
  refresh: EmptyFn;
} {
  const { publicKeyHash: currentAccountAddress } = useAccount();
  const nativeTezos = useTezos();
  const nativeRpcUrl = useMemo(() => nativeTezos.rpc.getRpcUrl(), [nativeTezos]);

  const rpcUrl = networkRpc ?? nativeRpcUrl;

  const chainIdSwrRes = useChainIdLoading(rpcUrl);
  const chainId = chainIdSwrRes.data;

  const scope = useMetadataScope();
  const queryClient = useQueryClient();
  const balances = useAllAccountBalancesSelector(address, chainId ?? '', networkRpc);
  const usingStore = address === currentAccountAddress && !networkRpc && isKnownChainId(chainId);
  const request = useBalancesQuery(address, usingStore);
  const refreshStored = useCallback(() => {
    void refreshBalances(queryClient, { ...scope, account: address });
  }, [queryClient, scope, address]);

  const tezos = useMemo(() => (networkRpc ? buildTezosToolkit(networkRpc) : nativeTezos), [networkRpc, nativeTezos]);

  const onChainBalanceSwrRes = useTypedSWR(
    usingStore || !chainId ? null : getBalanceSWRKey(tezos, assetSlug, address),
    () => {
      return fetchRawBalanceFromBlockchain(tezos, assetSlug, address).then(res => res.toString());
    },
    {
      revalidateOnFocus: true,
      dedupingInterval: 20_000
    }
  );

  const refreshChainId = useCallback(() => chainIdSwrRes.mutate(), [chainIdSwrRes.mutate]);
  const refreshBalanceOnChain = useCallback(() => void onChainBalanceSwrRes.mutate(), [onChainBalanceSwrRes.mutate]);

  useOnBlock(refreshBalanceOnChain, tezos, !chainId || usingStore);

  if (!chainId)
    return {
      value: undefined,
      isSyncing: chainIdSwrRes.isValidating,
      error: chainIdSwrRes.error,
      refresh: refreshChainId
    };

  if (usingStore)
    return {
      value: balances[assetSlug],
      isSyncing: request.isLoading,
      error: request.error,
      refresh: refreshStored
    };

  return {
    value: onChainBalanceSwrRes.data,
    isSyncing: onChainBalanceSwrRes.isValidating,
    error: onChainBalanceSwrRes.error,
    refresh: refreshBalanceOnChain
  };
}

export function useBalance(assetSlug: string, address: string, networkRpc?: string) {
  const { value: rawValue, isSyncing, error, refresh } = useRawBalance(assetSlug, address, networkRpc);
  const assetMetadata = useAssetMetadata(assetSlug);

  const value = useMemo(
    () => (rawValue && assetMetadata ? atomsToTokens(new BigNumber(rawValue), assetMetadata.decimals) : undefined),
    [rawValue, assetMetadata]
  );

  return {
    rawValue,
    value,
    isSyncing,
    error,
    refresh,
    assetMetadata
  };
}

const buildTezosToolkit = memoizee(
  (rpcUrl: string) => {
    const t = new ReactiveTezosToolkit(loadFastRpcClient(rpcUrl), rpcUrl);
    t.setPackerProvider(michelEncoder);
    return t;
  },
  {
    max: 15,
    maxAge: 5 * 60_000
  }
);
