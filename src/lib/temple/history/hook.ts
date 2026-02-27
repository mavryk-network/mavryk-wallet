import { useMemo } from 'react';

import { GetOperationsTransactionsParams, isKnownChainId } from 'lib/apis/mvkt/api';
import { useAccount, useChainId, useTezos } from 'lib/temple/front';
import { useDidMount, useDidUpdate, useSafeState, useStopper } from 'lib/ui/hooks';

import { TempleAccount } from '../types';

import fetchUserHistory from './fetch';
import { UserHistoryItem } from './types';

type TLoading = 'init' | 'more' | false;

// origination, delegation
// transfer to -> transaction -> initiator -> me, entrypoint -> transfer
// transfer from -> transaction -> target -> me, entrypoint -> transfer
// interaction ******************

//  transactiuon && if (isZero(item.amountSigned) && item.entrypoint !== undefined) {
//         return HistoryItemOpTypeEnum.Interaction;
//       }

// ******************
// reveal -> type -> reveal
// swap -> entrypoint -> swap && transaction
// other -> type === other || transaction &&  ???

export default function useHistory(
  initialPseudoLimit: number,
  assetSlug?: string,
  operationParams?: GetOperationsTransactionsParams,
  differentAccount?: TempleAccount
) {
  const tezos = useTezos();
  const chainId = useChainId(true);
  const originalAccount = useAccount();

  const account = differentAccount ? differentAccount : originalAccount;

  const accountAddress = account.publicKeyHash;

  const [loading, setLoading] = useSafeState<TLoading>(isKnownChainId(chainId) && 'init');
  const [userHistory, setUserHistory] = useSafeState<UserHistoryItem[]>([]);
  const [reachedTheEnd, setReachedTheEnd] = useSafeState(false);

  const { stop: stopLoading, stopAndBuildChecker } = useStopper();

  // stable boolean, not the params object itself
  const hasParameters = useMemo(() => {
    return Boolean(operationParams) && typeof operationParams === 'object' && Object.keys(operationParams).length !== 0;
  }, [operationParams]);

  const paramsKey = useMemo(() => {
    // if params order can vary, stringify is fine but this is safer-ish for small objects
    if (!hasParameters) return '';
    try {
      return JSON.stringify(operationParams);
    } catch {
      return 'unstringifiable';
    }
  }, [hasParameters, operationParams]);

  async function loadUserHistory(pseudoLimit: number, historyItems: UserHistoryItem[], shouldStop: () => boolean) {
    if (!isKnownChainId(chainId)) {
      setLoading(false);
      setReachedTheEnd(true);
      return;
    }

    setLoading(historyItems.length ? 'more' : 'init');
    const lastHistoryItem = historyItems[historyItems.length - 1];

    let newHistoryItems: UserHistoryItem[];

    try {
      newHistoryItems = await fetchUserHistory(
        chainId,
        account,
        assetSlug,
        pseudoLimit,
        tezos,
        lastHistoryItem,
        operationParams
      );
      if (shouldStop()) return;
    } catch (error) {
      if (shouldStop()) return;
      setLoading(false);
      console.error('History hook fetch error:', error);
      return;
    }

    setUserHistory(prev => {
      const newUniqueItems = newHistoryItems.filter(item => !prev.some(prevItem => prevItem.hash === item.hash));

      if (newUniqueItems.length === 0) {
        setReachedTheEnd(true);
        return prev;
      }

      // merge + dedupe
      const merged = [...prev, ...newUniqueItems];
      return Array.from(new Map(merged.map(item => [item.hash, item])).values());
    });

    setLoading(false);
    if (newHistoryItems.length === 0) setReachedTheEnd(true);
  }

  function loadMore(pseudoLimit: number) {
    if (loading || reachedTheEnd) return;
    loadUserHistory(pseudoLimit, userHistory, stopAndBuildChecker());
  }

  useDidUpdate(() => {
    // cancel any in-flight requests from previous key
    const shouldStop = stopAndBuildChecker();

    // reset state immediately so UI doesn't show old account history
    setUserHistory([]);
    setLoading(isKnownChainId(chainId) ? 'init' : false);
    setReachedTheEnd(false);

    // fetch fresh
    loadUserHistory(initialPseudoLimit, [], shouldStop);

    // cleanup cancels in-flight if key changes/unmounts
    return stopLoading;
  }, [chainId, accountAddress, assetSlug, paramsKey, initialPseudoLimit]);

  // If you want initial mount to also fetch, keep this:
  useDidMount(() => {
    const shouldStop = stopAndBuildChecker();
    loadUserHistory(initialPseudoLimit, [], shouldStop);
    return stopLoading;
  });

  return {
    loading,
    reachedTheEnd,
    list: userHistory,
    loadMore
  };
}
