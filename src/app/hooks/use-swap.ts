import { useCallback, useEffect, useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
import { BigNumber } from 'bignumber.js';
import { useDispatch } from 'react-redux';

import { loadSwapParamsAction, resetSwapParamsAction } from 'app/store/swap/actions';
import type { Route3Token } from 'lib/apis/route3/fetch-route3-tokens';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { serializeQueryKey, swapKeys } from 'lib/query-keys';
import {
  Route3LiquidityBakingChains,
  Route3SwapChains,
  Route3SwapParamsRequest,
  Route3SwapParamsRequestRaw
} from 'lib/route3/interfaces';
import { useAccount, useChainId, useTezos } from 'lib/temple/front';
import { useOnBlock } from 'lib/temple/front/chain';
import { useUpdatableRef } from 'lib/ui/hooks';
import { getSwapTransferParams } from 'lib/utils/swap.utils';

export const SWAP_QUOTE_REFETCH_INTERVAL = BLOCK_DURATION;

export const DISABLED_SWAP_PARAMS_REQUEST: Route3SwapParamsRequestRaw = {
  fromSymbol: '',
  toSymbol: '',
  amount: undefined,
  chainsLimit: undefined
};

export const isSwapParamsRequestReady = (
  params: Route3SwapParamsRequestRaw | null,
  account: string | null | undefined,
  chainId: string | null | undefined
): params is Route3SwapParamsRequest =>
  Boolean(account) &&
  Boolean(chainId) &&
  params !== null &&
  isDefined(params.amount) &&
  new BigNumber(params.amount).isGreaterThan(0) &&
  params.fromSymbol.length > 0 &&
  params.toSymbol.length > 0;

export const getSwapParamsKey = (
  account: string | null | undefined,
  chainId: string | null | undefined,
  params: Route3SwapParamsRequestRaw | null
) =>
  params !== null && account && chainId && isSwapParamsRequestReady(params, account, chainId)
    ? swapKeys.params(account, chainId, params)
    : swapKeys.params('', '', DISABLED_SWAP_PARAMS_REQUEST);

export const useBlockAwareSwapParams = (params: Route3SwapParamsRequestRaw | null) => {
  const dispatch = useDispatch();
  const { publicKeyHash } = useAccount();
  const chainId = useChainId();

  const paramsRef = useUpdatableRef(params);
  const isReady = isSwapParamsRequestReady(params, publicKeyHash, chainId);
  const isReadyRef = useUpdatableRef(isReady);

  const swapParamsKey = useMemo(
    () => getSwapParamsKey(publicKeyHash, chainId, params),
    [chainId, params?.amount, params?.chainsLimit, params?.fromSymbol, params?.toSymbol, publicKeyHash]
  );
  const swapParamsKeyHash = useMemo(() => serializeQueryKey(swapParamsKey), [swapParamsKey]);

  const refreshSwapParams = useCallback(() => {
    const currentParams = paramsRef.current;

    if (!isReadyRef.current || currentParams === null) {
      return;
    }

    dispatch(loadSwapParamsAction.submit(currentParams));
  }, [dispatch, isReadyRef, paramsRef]);

  // Sync the Redux quote data to the active account/chain/request key.
  // Cleanup is not needed because the swap epic cancels superseded request streams.
  useEffect(() => {
    if (isReady) {
      refreshSwapParams();
    } else {
      dispatch(resetSwapParamsAction());
    }
  }, [dispatch, isReady, refreshSwapParams, swapParamsKeyHash]);

  const hasBlockSubscription = useOnBlock(refreshSwapParams, undefined, !isReady);

  // Refetch at approximately block cadence while the block stream is unavailable.
  // Cleanup clears the timer when the quote key changes, the stream recovers, or the form unmounts.
  useEffect(() => {
    if (!isReady || hasBlockSubscription) {
      return;
    }

    const refetchInterval = setInterval(refreshSwapParams, SWAP_QUOTE_REFETCH_INTERVAL);

    return () => clearInterval(refetchInterval);
  }, [hasBlockSubscription, isReady, refreshSwapParams, swapParamsKeyHash]);

  return {
    hasBlockSubscription,
    isReady,
    swapParamsKey
  };
};

export const useSwap = () => {
  const tezos = useTezos();
  const { publicKeyHash } = useAccount();

  return useCallback(
    async (
      fromRoute3Token: Route3Token,
      toRoute3Token: Route3Token,
      inputAmountAtomic: BigNumber,
      minimumReceivedAtomic: BigNumber,
      chains: Route3SwapChains | Route3LiquidityBakingChains
    ) =>
      getSwapTransferParams(
        fromRoute3Token,
        toRoute3Token,
        inputAmountAtomic,
        minimumReceivedAtomic,
        chains,
        tezos,
        publicKeyHash
      ),
    [tezos, publicKeyHash]
  );
};
