import { QueryClient } from '@tanstack/react-query';

import { fixBalances } from 'app/store/balances/utils';
import { fetchAllAssetsBalancesFromTzkt, fetchTezosBalanceFromTzkt, isKnownChainId } from 'lib/apis/tzkt';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { balancesKeys } from 'lib/query-keys';
import { BalanceScope } from 'lib/store/zustand/balances-state.schema';

import { syncBalances } from './sync-balances';

export type BalanceCategory = 'native' | 'tokens';

/** One account-wide token request, with shared Query lifecycle and receipt-only results. */
export function balanceQueryOptions(scope: BalanceScope, category: BalanceCategory) {
  return {
    queryKey: balancesKeys.request(scope, category),
    queryFn: ({ signal }: { signal?: AbortSignal }) =>
      syncBalances(
        scope,
        async () => {
          if (!isKnownChainId(scope.chainId)) throw new Error('Unsupported balance chain');
          if (category === 'native')
            return { [MAV_TOKEN_SLUG]: await fetchTezosBalanceFromTzkt(scope.account, scope.chainId) };
          return fixBalances(await fetchAllAssetsBalancesFromTzkt(scope.account, scope.chainId));
        },
        signal
      ),
    staleTime: 20_000,
    cacheTime: 5 * 60_000,
    retry: false as const,
    refetchOnWindowFocus: false as const,
    refetchOnReconnect: true as const
  };
}

const refreshes = new WeakMap<QueryClient, Map<string, Promise<void>>>();

/** Coalesce refresh triggers and schedule one follow-up when a snapshot was already in flight. */
export function refreshBalances(client: QueryClient, scope: BalanceScope, category?: BalanceCategory): Promise<void> {
  let pending = refreshes.get(client);
  if (!pending) {
    pending = new Map();
    refreshes.set(client, pending);
  }
  const queryKey = category ? balancesKeys.request(scope, category) : balancesKeys.scope(scope);
  const key = JSON.stringify(queryKey);
  const existing = pending.get(key);
  if (existing) return existing;
  const wasFetching = client.isFetching({ queryKey }) > 0;
  const request = client
    .invalidateQueries({ queryKey }, { cancelRefetch: false })
    .then(async () => {
      if (wasFetching) await client.invalidateQueries({ queryKey }, { cancelRefetch: false });
    })
    .finally(() => pending?.delete(key));
  pending.set(key, request);
  return request;
}
