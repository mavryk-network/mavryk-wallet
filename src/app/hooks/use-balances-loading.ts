import { useCallback, useEffect, useRef, useState } from 'react';

import { isDefined } from '@rnw-community/shared';
import { noop } from 'lodash';

import {
  MvktSubscriptionChannel,
  MvktSubscriptionMethod,
  MvktSubscriptionStateMessageType,
  MvktAccountsSubscriptionMessage,
  MvktTokenBalancesSubscriptionMessage,
  MvktAccountType,
  isKnownChainId,
  calcMvktAccountSpendableTezBalance,
  fetchTezosBalanceFromMvkt,
  fetchAllAssetsBalancesFromMvkt
} from 'lib/apis/mvkt';
import type { MvktApiChainId } from 'lib/apis/mvkt';
import { toTokenSlug } from 'lib/assets';
import { fixBalances } from 'lib/balances/utils';
import { balancesStore, useBalancesLoadingSelector, useBalancesErrorSelector } from 'lib/store/zustand/balances.store';
import { useAccount, useChainId, useOnBlock, useMvktConnection } from 'lib/temple/front';
import { useDidUpdate } from 'lib/ui/hooks';
import { getErrorMessage } from 'lib/utils/get-error-message';

const { getState } = balancesStore;

/** Fetch gas balance from TzKT and write to Zustand store */
const fetchAndSetGasBalance = async (publicKeyHash: string, chainId: MvktApiChainId) => {
  try {
    const balance = await fetchTezosBalanceFromMvkt(publicKeyHash, chainId);
    getState().setGasBalance(publicKeyHash, chainId, balance);
  } catch (err: unknown) {
    getState().setGasBalanceError(publicKeyHash, chainId, getErrorMessage(err));
  }
};

/** Fetch all asset balances from TzKT and write to Zustand store */
const fetchAndSetAssetsBalances = async (publicKeyHash: string, chainId: MvktApiChainId) => {
  getState().setAssetsBalancesLoading(publicKeyHash, chainId);
  try {
    const balances = await fetchAllAssetsBalancesFromMvkt(publicKeyHash, chainId);
    fixBalances(balances);
    getState().setAssetsBalancesSuccess(publicKeyHash, chainId, balances);
  } catch (err: unknown) {
    getState().setAssetsBalancesError(publicKeyHash, chainId, getErrorMessage(err));
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

  const { connection, connectionReady } = useMvktConnection();
  const [tokensSubscriptionConfirmed, setTokensSubscriptionConfirmed] = useState(false);
  const [accountsSubscriptionConfirmed, setAccountsSubscriptionConfirmed] = useState(false);

  const tokenBalancesListener = useCallback(
    (msg: MvktTokenBalancesSubscriptionMessage) => {
      const skip = isLoadingRef.current || !isKnownChainId(chainId);

      switch (msg.type) {
        case MvktSubscriptionStateMessageType.Reorg:
          if (skip) return;
          fetchAndSetAssetsBalances(publicKeyHash, chainId);
          break;
        case MvktSubscriptionStateMessageType.Data:
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
    (msg: MvktAccountsSubscriptionMessage) => {
      const skip = isLoadingRef.current || !isKnownChainId(chainId);

      switch (msg.type) {
        case MvktSubscriptionStateMessageType.Reorg:
          if (skip) return;
          fetchAndSetGasBalance(publicKeyHash, chainId);
          break;
        case MvktSubscriptionStateMessageType.Data:
          if (skip) return;
          const matchingAccount = msg.data.find(acc => acc.address === publicKeyHash);
          if (
            matchingAccount?.type === MvktAccountType.Contract ||
            matchingAccount?.type === MvktAccountType.Delegate ||
            matchingAccount?.type === MvktAccountType.User
          ) {
            const balance = calcMvktAccountSpendableTezBalance(matchingAccount);
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
      connection.on(MvktSubscriptionChannel.TokenBalances, tokenBalancesListener);
      connection.on(MvktSubscriptionChannel.Accounts, accountsListener);

      Promise.all([
        connection.invoke(MvktSubscriptionMethod.SubscribeToAccounts, { addresses: [publicKeyHash] }),
        connection.invoke(MvktSubscriptionMethod.SubscribeToTokenBalances, { account: publicKeyHash })
      ]).catch(e => console.error(e));

      return () => {
        setAccountsSubscriptionConfirmed(false);
        setTokensSubscriptionConfirmed(false);
        connection.off(MvktSubscriptionChannel.TokenBalances, tokenBalancesListener);
        connection.off(MvktSubscriptionChannel.Accounts, accountsListener);
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
      fetchAndSetGasBalance(publicKeyHash, chainId as MvktApiChainId);
      fetchAndSetAssetsBalances(publicKeyHash, chainId as MvktApiChainId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty: once

  // optional: expose info if you want
  return { isLoading, isStoredError };
};
