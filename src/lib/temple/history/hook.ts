import { isKnownChainId } from 'lib/apis/tzkt/api';
import { useAccount, useChainId, useTezos } from 'lib/temple/front';
import { useDidMount, useDidUpdate, useSafeState, useStopper } from 'lib/ui/hooks';

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

export default function useHistory(initialPseudoLimit: number, assetSlug?: string) {
  const tezos = useTezos();
  const chainId = useChainId(true);
  const account = useAccount();

  const accountAddress = account.publicKeyHash;

  const [loading, setLoading] = useSafeState<TLoading>(isKnownChainId(chainId) && 'init');
  const [userHistory, setUserHistory] = useSafeState<UserHistoryItem[]>([]);
  const [reachedTheEnd, setReachedTheEnd] = useSafeState(false);

  const { stop: stopLoading, stopAndBuildChecker } = useStopper();

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
      newHistoryItems = await fetchUserHistory(chainId, account, assetSlug, pseudoLimit, tezos, lastHistoryItem);
      // console.log('Logging user history in the History Hook:', newHistoryItems);
      if (shouldStop()) return;
    } catch (error) {
      if (shouldStop()) return;
      setLoading(false);
      console.error('Logging error in History Hook after fetching history items:', error);
      return;
    }

    setUserHistory(historyItems.concat(newHistoryItems));
    setLoading(false);
    if (newHistoryItems.length === 0) setReachedTheEnd(true);
  }

  /** Loads more of older items */
  function loadMore(pseudoLimit: number) {
    if (loading || reachedTheEnd) return;
    loadUserHistory(pseudoLimit, userHistory, stopAndBuildChecker());
  }

  useDidMount(() => {
    loadUserHistory(initialPseudoLimit, [], stopAndBuildChecker());

    return stopLoading;
  });

  useDidUpdate(() => {
    setUserHistory([]);
    setLoading('init');
    setReachedTheEnd(false);

    loadUserHistory(initialPseudoLimit, [], stopAndBuildChecker());
  }, [chainId, accountAddress, assetSlug]);

  return {
    loading,
    reachedTheEnd,
    list: userHistory,
    loadMore
  };
}
