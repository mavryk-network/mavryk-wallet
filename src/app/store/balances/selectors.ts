import { useMemo } from 'react';

import { useBalancesQuery } from 'lib/balances/use-balances-query';
import { useMetadataScope } from 'lib/metadata/use-metadata-scope';
import { getBalanceScopeKey } from 'lib/store/zustand/balances-state.schema';
import { useOwnedUI } from 'lib/store/zustand/ui-client';

const EMPTY_BALANCES_RECORD = {};

/** Legacy projections remain compatible; current consumers select exact source records below. */
export const useAllBalancesSelector = () => {
  const balances = useOwnedUI(state => state.balances);
  const scope = useMetadataScope();
  return useMemo(() => {
    const records = Object.fromEntries(
      Object.entries(balances.legacy).map(([key, data]) => [key, { data, isLoading: false }])
    );
    for (const [key, bucket] of Object.entries(balances.scoped)) {
      const [account, chainId, networkId, rpcUrl] = JSON.parse(key);
      if (networkId !== scope.networkId || rpcUrl !== scope.rpcUrl) continue;
      const legacyKey = `${account}_${chainId}`;
      records[legacyKey] = { data: { ...records[legacyKey]?.data, ...bucket.data }, isLoading: false };
    }
    return records;
  }, [balances, scope.networkId, scope.rpcUrl]);
};

export const useAllAccountBalancesSelector = (publicKeyHash: string, chainId: string, rpcUrl?: string) => {
  const selected = useMetadataScope();
  const scope = { ...selected, account: publicKeyHash, chainId, rpcUrl: rpcUrl ?? selected.rpcUrl };
  const scoped = useOwnedUI(state => state.balances.scoped[getBalanceScopeKey(scope)]?.data);
  const legacy = useOwnedUI(state =>
    rpcUrl === undefined ? state.balances.legacy[`${publicKeyHash}_${chainId}`] : undefined
  );
  return useMemo(() => (scoped ? { ...legacy, ...scoped } : legacy ?? EMPTY_BALANCES_RECORD), [scoped, legacy]);
};

export const useBalanceSelector = (publicKeyHash: string, chainId: string, assetSlug: string): string | undefined =>
  useAllAccountBalancesSelector(publicKeyHash, chainId)[assetSlug];

export const useBalancesLoadingSelector = (publicKeyHash: string, _chainId: string) =>
  useBalancesQuery(publicKeyHash, false).isLoading;

export const useBalancesErrorSelector = (publicKeyHash: string, _chainId: string) =>
  useBalancesQuery(publicKeyHash, false).error;
