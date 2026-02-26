import { useCallback, useEffect, useRef, useState } from 'react';

import { isDefined } from '@rnw-community/shared';
import { noop } from 'lodash';

import {
  TzktSubscriptionChannel,
  TzktSubscriptionMethod,
  TzktSubscriptionStateMessageType,
  TzktAccountsSubscriptionMessage,
  TzktTokenBalancesSubscriptionMessage,
  TzktAccountType,
  isKnownChainId,
  calcTzktAccountSpendableTezBalance,
  fetchTezosBalanceFromTzkt,
  fetchAllAssetsBalancesFromTzkt
} from 'lib/apis/tzkt';
import type { TzktApiChainId } from 'lib/apis/tzkt';
import { toTokenSlug } from 'lib/assets';
import {
  balancesStore,
  useBalancesLoadingSelector,
  useBalancesErrorSelector
} from 'lib/store/zustand/balances.store';
import { fixBalances } from 'app/store/balances/utils';
import { useAccount, useChainId, useOnBlock, useTzktConnection } from 'lib/temple/front';
import { useDidUpdate } from 'lib/ui/hooks';

const { getState } = balancesStore;

/** Fetch gas balance from TzKT and write to Zustand store */
const fetchAndSetGasBalance = async (publicKeyHash: string, chainId: TzktApiChainId) => {
  try {
    const balance = await fetchTezosBalanceFromTzkt(publicKeyHash, chainId);
    getState().setGasBalance(publicKeyHash, chainId, balance);
  } catch (err: any) {
    getState().setGasBalanceError(publicKeyHash, chainId, err?.message ?? String(err));
  }
};

/** Fetch all asset balances from TzKT and write to Zustand store */
const fetchAndSetAssetsBalances = async (publicKeyHash: string, chainId: TzktApiChainId) => {
  getState().setAssetsBalancesLoading(publicKeyHash, chainId);
  try {
    const balances = await fetchAllAssetsBalancesFromTzkt(publicKeyHash, chainId);
    fixBalances(balances);
    getState().setAssetsBalancesSuccess(publicKeyHash, chainId, balances);
  } catch (err: any) {
    getState().setAssetsBalancesError(publicKeyHash, chainId, err?.message ?? String(err));
  }
};

export const useBalancesLoading = () => {
  const chainId = useChainId(true)!;
  const { publicKeyHash } = useAccount();

  const isLoading = useBalancesLoadingSelector(publicKeyHash, chainId);
  const isLoadingRef = useRef(false);

  useDidUpdate(() => {
    // Persisted `isLoading` value might be `true`.
    // Using initial `false` & only updating on further changes.
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const storedError = useBalancesErrorSelector(publicKeyHash, chainId);
  const isStoredError = isDefined(storedError);

  const { connection, connectionReady } = useTzktConnection();
  const [tokensSubscriptionConfirmed, setTokensSubscriptionConfirmed] = useState(false);
  const [accountsSubscriptionConfirmed, setAccountsSubscriptionConfirmed] = useState(false);

  const tokenBalancesListener = useCallback(
    (msg: TzktTokenBalancesSubscriptionMessage) => {
      const skip = isLoadingRef.current || !isKnownChainId(chainId);

      switch (msg.type) {
        case TzktSubscriptionStateMessageType.Reorg:
          if (skip) return;
          fetchAndSetAssetsBalances(publicKeyHash, chainId);
          break;
        case TzktSubscriptionStateMessageType.Data:
          if (skip) return;
          const balances: StringRecord = {};
          msg.data.forEach(({ account, token, balance }) => {
            if (account.address !== publicKeyHash) return;

            balances[toTokenSlug(token.contract.address, token.tokenId)] = balance;
          });
          fixBalances(balances);
          if (Object.keys(balances).length > 0) {
            getState().putTokensBalances(publicKeyHash, chainId, balances);
          }
          break;
        default:
          setTokensSubscriptionConfirmed(true);
      }
    },
    [publicKeyHash, chainId, isLoadingRef]
  );

  const accountsListener = useCallback(
    (msg: TzktAccountsSubscriptionMessage) => {
      const skip = isLoadingRef.current || !isKnownChainId(chainId);

      switch (msg.type) {
        case TzktSubscriptionStateMessageType.Reorg:
          if (skip) return;
          fetchAndSetGasBalance(publicKeyHash, chainId);
          break;
        case TzktSubscriptionStateMessageType.Data:
          if (skip) return;
          const matchingAccount = msg.data.find(acc => acc.address === publicKeyHash);
          if (
            matchingAccount?.type === TzktAccountType.Contract ||
            matchingAccount?.type === TzktAccountType.Delegate ||
            matchingAccount?.type === TzktAccountType.User
          ) {
            const balance = calcTzktAccountSpendableTezBalance(matchingAccount);
            getState().setGasBalance(publicKeyHash, chainId, balance);
          } else if (matchingAccount) {
            fetchAndSetGasBalance(publicKeyHash, chainId);
          }
          break;
        default:
          setAccountsSubscriptionConfirmed(true);
      }
    },
    [publicKeyHash, chainId, isLoadingRef]
  );

  useEffect(() => {
    if (connection && connectionReady) {
      connection.on(TzktSubscriptionChannel.TokenBalances, tokenBalancesListener);
      connection.on(TzktSubscriptionChannel.Accounts, accountsListener);

      Promise.all([
        connection.invoke(TzktSubscriptionMethod.SubscribeToAccounts, { addresses: [publicKeyHash] }),
        connection.invoke(TzktSubscriptionMethod.SubscribeToTokenBalances, { account: publicKeyHash })
      ]).catch(e => console.error(e));

      return () => {
        setAccountsSubscriptionConfirmed(false);
        setTokensSubscriptionConfirmed(false);
        connection.off(TzktSubscriptionChannel.TokenBalances, tokenBalancesListener);
        connection.off(TzktSubscriptionChannel.Accounts, accountsListener);
      };
    }

    return noop;
  }, [accountsListener, tokenBalancesListener, connection, connectionReady, publicKeyHash]);

  const loadGasBalance = useCallback(() => {
    if (isLoadingRef.current === false && isKnownChainId(chainId)) {
      fetchAndSetGasBalance(publicKeyHash, chainId);
    }
  }, [publicKeyHash, chainId, isLoadingRef]);

  useEffect(loadGasBalance, [loadGasBalance]);
  useOnBlock(loadGasBalance, undefined, accountsSubscriptionConfirmed && isStoredError === false);

  const loadAssetsBalances = useCallback(() => {
    if (isLoadingRef.current === false && isKnownChainId(chainId)) {
      fetchAndSetAssetsBalances(publicKeyHash, chainId);
    }
  }, [publicKeyHash, chainId, isLoadingRef]);

  useEffect(loadAssetsBalances, [loadAssetsBalances]);
  useOnBlock(loadAssetsBalances, undefined, tokensSubscriptionConfirmed && isStoredError === false);
};

export const useBalancesLoadingOnce = (publicKeyHash: string) => {
  const chainId = useChainId(true)!;

  const isLoading = useBalancesLoadingSelector(publicKeyHash, chainId);
  const isLoadingRef = useRef(false);

  // keep latest loading flag (same idea as your hook)
  useDidUpdate(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const storedError = useBalancesErrorSelector(publicKeyHash, chainId);
  const isStoredError = isDefined(storedError);

  // run only once per mount (and only for that PKH+chainId)
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    if (!publicKeyHash || !isKnownChainId(chainId)) return;

    // initial load (no subscriptions, no polling)
    if (isLoadingRef.current === false && isStoredError === false) {
      fetchAndSetGasBalance(publicKeyHash, chainId as TzktApiChainId);
      fetchAndSetAssetsBalances(publicKeyHash, chainId as TzktApiChainId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty: once

  // optional: expose info if you want
  return { isLoading, isStoredError };
};
