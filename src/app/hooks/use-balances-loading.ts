import { useEffect } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { fixBalances } from 'app/store/balances/utils';
import {
  TzktSubscriptionChannel,
  TzktSubscriptionMethod,
  TzktSubscriptionStateMessageType,
  TzktAccountsSubscriptionMessage,
  TzktTokenBalancesSubscriptionMessage,
  isKnownChainId,
  calcTzktAccountSpendableTezBalance
} from 'lib/apis/tzkt';
import { MAV_TOKEN_SLUG, toTokenSlug } from 'lib/assets';
import { refreshBalances } from 'lib/balances/balance-query';
import { syncBalances } from 'lib/balances/sync-balances';
import { useBalancesQuery } from 'lib/balances/use-balances-query';
import { useLoadPerfSettledMark } from 'lib/load-perf';
import { useMetadataScope } from 'lib/metadata/use-metadata-scope';
import { balancesKeys } from 'lib/query-keys';
import { BALANCE_RECORD_SCHEMA } from 'lib/store/zustand/balances-state.schema';
import { parseData } from 'lib/store/zustand/validation';
import { useTzktConnection } from 'lib/temple/front';

/** One mounted driver owns account subscriptions; block/confirmation refresh uses the shared Query client. */
export const useBalancesLoading = () => {
  const scope = useMetadataScope();
  const client = useQueryClient();
  const { isLoading, error } = useBalancesQuery(scope.account);
  useLoadPerfSettledMark('balances-fresh', isLoading, !!error);
  const { connection, connectionReady } = useTzktConnection();

  // Attach scoped socket listeners; abort queued publications and remove both listeners on disconnect/scope change.
  useEffect(() => {
    if (!connection || !connectionReady || !isKnownChainId(scope.chainId)) return;
    const controller = new AbortController();
    let queue = Promise.resolve();
    const enqueue = (
      category: 'native' | 'tokens',
      level: number,
      isReorg: boolean,
      load: () => Record<string, string>
    ) => {
      queue = queue
        .then(async () => {
          if (controller.signal.aborted) return;
          await client.fetchQuery({
            queryKey: balancesKeys.request(scope, `subscription-${category}`),
            queryFn: () => syncBalances(scope, async () => load(), controller.signal, { category, level, isReorg }),
            staleTime: 0,
            cacheTime: 5 * 60_000,
            retry: false
          });
          if (isReorg) void refreshBalances(client, scope, category);
        })
        .catch(() => {
          // Query retains the error; block fallback remains active and cached owner balances survive.
          if (!controller.signal.aborted) void refreshBalances(client, scope, category);
        });
    };
    const tokens = (msg: TzktTokenBalancesSubscriptionMessage) => {
      if (msg.type === TzktSubscriptionStateMessageType.Subscribed) {
        void refreshBalances(client, scope, 'tokens');
        return;
      }
      enqueue('tokens', msg.state, msg.type === TzktSubscriptionStateMessageType.Reorg, () => {
        const records: Record<string, string> = {};
        if (msg.type === TzktSubscriptionStateMessageType.Data) {
          for (const { account, token, balance } of msg.data) {
            if (account.address === scope.account)
              records[toTokenSlug(token.contract.address, token.tokenId)] = balance;
          }
        }
        return fixBalances(parseData(BALANCE_RECORD_SCHEMA, records));
      });
    };
    const accounts = (msg: TzktAccountsSubscriptionMessage) => {
      if (msg.type === TzktSubscriptionStateMessageType.Subscribed) {
        void refreshBalances(client, scope, 'native');
        return;
      }
      enqueue('native', msg.state, msg.type === TzktSubscriptionStateMessageType.Reorg, (): Record<string, string> => {
        if (msg.type !== TzktSubscriptionStateMessageType.Data) return {};
        const account = msg.data.find(value => value.address === scope.account);
        if (!account) return {};
        return { [MAV_TOKEN_SLUG]: calcTzktAccountSpendableTezBalance(account) };
      });
    };
    connection.on(TzktSubscriptionChannel.TokenBalances, tokens);
    connection.on(TzktSubscriptionChannel.Accounts, accounts);
    void Promise.all([
      connection.invoke(TzktSubscriptionMethod.SubscribeToAccounts, { addresses: [scope.account] }),
      connection.invoke(TzktSubscriptionMethod.SubscribeToTokenBalances, { account: scope.account })
    ]).catch(() => {
      if (!controller.signal.aborted) void refreshBalances(client, scope);
    });
    return () => {
      controller.abort();
      connection.off(TzktSubscriptionChannel.TokenBalances, tokens);
      connection.off(TzktSubscriptionChannel.Accounts, accounts);
    };
  }, [client, scope, connection, connectionReady]);
};

export const useBalancesLoadingOnce = (publicKeyHash: string) => useBalancesQuery(publicKeyHash);
