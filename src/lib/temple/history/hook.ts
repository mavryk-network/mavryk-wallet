import { useMemo } from 'react';

import { GetOperationsTransactionsParams, isKnownChainId } from 'lib/apis/tzkt/api';
import { useAccount, useChainId, useNetwork, useTezos } from 'lib/temple/front';
import { useDidMount, useDidUpdate, useSafeState, useStopper } from 'lib/ui/hooks';
import { MavrykApiError, toSafeLogError } from 'mavryk/api/errors';

import { TempleAccount } from '../types';

import fetchUserHistory, { FetchUserHistoryResult, isWatchOnlyAccount } from './fetch';
import { mergeHistoryPage } from './merge';
import { UserHistoryItem } from './types';
import { usePurchaseMetadata } from './use-purchase-metadata';

type TLoading = 'init' | 'more' | false;

/** Consecutive pages without new cards fetched automatically before handing control back to "load more". */
const MAX_EMPTY_PAGE_FOLLOW_UPS = 3;

/** Fallback Watch only cooldown when a failure carries no usable `Retry-After` (one cold read per minute). */
const WATCH_ONLY_DEFAULT_RETRY_AFTER_SECONDS = 60;

type EquiteezStatus = FetchUserHistoryResult['equiteezStatus'];

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
  differentAccount?: TempleAccount,
  tokenAddress?: string
) {
  const tezos = useTezos();
  const chainId = useChainId(true);
  const { id: networkId } = useNetwork();
  const originalAccount = useAccount();

  const account = differentAccount ? differentAccount : originalAccount;

  const accountAddress = account.publicKeyHash;
  const isWatchOnly = isWatchOnlyAccount(account);
  /** Watch only accounts have no public per-asset history route, so asset-scoped history is never requested. */
  const isAssetHistoryUnsupported = isWatchOnly && Boolean(assetSlug || tokenAddress);
  const resolvePurchaseDecimals = usePurchaseMetadata(accountAddress);

  const [loading, setLoading] = useSafeState<TLoading>(isKnownChainId(chainId) && !isAssetHistoryUnsupported && 'init');
  const [userHistory, setUserHistory] = useSafeState<UserHistoryItem[]>([]);
  const [reachedTheEnd, setReachedTheEnd] = useSafeState(false);
  const [cursor, setCursor] = useSafeState<number | undefined>(undefined);
  const [error, setError] = useSafeState<Error | null>(null);
  /** Enrichment status per loaded page, so a later available page never hides an earlier unavailable one. */
  const [equiteezStatuses, setEquiteezStatuses] = useSafeState<EquiteezStatus[]>([]);
  /** Watch only: epoch ms before which retry/load-more must not hit the shared one-per-minute allowance. */
  const [retryAvailableAt, setRetryAvailableAt] = useSafeState<number | null>(null);

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

  async function loadUserHistory(
    pseudoLimit: number,
    historyItems: UserHistoryItem[],
    nextCursor: number | undefined,
    shouldStop: () => boolean,
    emptyFollowUps = 0
  ) {
    if (!isKnownChainId(chainId) || isAssetHistoryUnsupported) {
      setLoading(false);
      setReachedTheEnd(true);
      return;
    }

    setLoading(historyItems.length ? 'more' : 'init');
    setError(null);
    setRetryAvailableAt(null);
    let fetchResult: FetchUserHistoryResult;

    try {
      fetchResult = await fetchUserHistory(
        chainId,
        account,
        assetSlug,
        pseudoLimit,
        tezos,
        nextCursor,
        operationParams,
        resolvePurchaseDecimals,
        tokenAddress,
        networkId
      );
      if (shouldStop()) return;
    } catch (fetchError) {
      if (shouldStop()) return;
      // Existing rows stay; the same cursor is retried on the next load.
      setLoading(false);
      setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
      // A failed Watch only read still spends the endpoint's cold allowance: hold retries until it is restored.
      if (isWatchOnly && !(fetchError instanceof MavrykApiError && fetchError.isCancelled)) {
        const retryAfterSeconds =
          fetchError instanceof MavrykApiError && fetchError.retryAfterSeconds !== undefined
            ? fetchError.retryAfterSeconds
            : WATCH_ONLY_DEFAULT_RETRY_AFTER_SECONDS;
        setRetryAvailableAt(Date.now() + retryAfterSeconds * 1000);
      }
      // The raw error's cause holds the request config, including the bearer access token.
      console.error('History hook fetch error:', toSafeLogError(fetchError));
      return;
    }

    const { items: pageItems, cursor: returnedCursor, hasMore, equiteezStatus } = fetchResult;
    const { items: mergedItems, addedCount } = mergeHistoryPage(historyItems, pageItems);

    setUserHistory(mergedItems);
    setEquiteezStatuses(prev => [...prev, equiteezStatus]);
    setCursor(returnedCursor);

    // A short, empty or already-known page with more=true is not the end: follow the cursor a bounded number of times.
    // Watch only pages share a one-per-minute cold allowance, so continuation is left to an explicit load more.
    if (!isWatchOnly && hasMore && addedCount === 0 && emptyFollowUps < MAX_EMPTY_PAGE_FOLLOW_UPS) {
      await loadUserHistory(pseudoLimit, mergedItems, returnedCursor, shouldStop, emptyFollowUps + 1);
      return;
    }

    setLoading(false);
    setReachedTheEnd(!hasMore);
  }

  function loadMore(pseudoLimit: number) {
    if (loading || reachedTheEnd) return;
    if (retryAvailableAt !== null && Date.now() < retryAvailableAt) return;
    loadUserHistory(pseudoLimit, userHistory, cursor, stopAndBuildChecker());
  }

  useDidUpdate(() => {
    // cancel any in-flight requests from previous key
    const shouldStop = stopAndBuildChecker();

    // reset state immediately so UI doesn't show old account history
    setUserHistory([]);
    setLoading(isKnownChainId(chainId) && !isAssetHistoryUnsupported ? 'init' : false);
    setReachedTheEnd(false);
    setCursor(undefined);
    setError(null);
    setEquiteezStatuses([]);
    setRetryAvailableAt(null);

    // fetch fresh
    loadUserHistory(initialPseudoLimit, [], undefined, shouldStop);

    // cleanup cancels in-flight if key changes/unmounts
    return stopLoading;
  }, [
    chainId,
    networkId,
    accountAddress,
    isWatchOnly,
    assetSlug,
    paramsKey,
    initialPseudoLimit,
    resolvePurchaseDecimals,
    tokenAddress
  ]);

  // If you want initial mount to also fetch, keep this:
  useDidMount(() => {
    const shouldStop = stopAndBuildChecker();
    loadUserHistory(initialPseudoLimit, [], undefined, shouldStop);
    return stopLoading;
  });

  const equiteezStatus = useMemo<EquiteezStatus>(
    () =>
      equiteezStatuses.find(status => status === 'unavailable') ??
      equiteezStatuses.find(status => status === 'stale' || status === 'unknown'),
    [equiteezStatuses]
  );

  return {
    loading,
    reachedTheEnd,
    list: userHistory,
    error,
    /** Worst non-available enrichment status among loaded pages; undefined when all are available or legacy. */
    equiteezStatus,
    /** Watch only: retry/load more is blocked until this epoch ms after a failed public read. */
    retryAvailableAt,
    /** Watch only account on an asset page: no public per-asset history exists, so nothing is requested. */
    isAssetHistoryUnsupported,
    loadMore
  };
}
