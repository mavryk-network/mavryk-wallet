import { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';

import { Route3Token } from 'lib/apis/route3/fetch-route3-tokens';
import { Route3LiquidityBakingChains, Route3SwapChains } from 'lib/route3/interfaces';
import { useAccount, useMavryk } from 'lib/temple/front';
import { getSwapTransferParams } from 'lib/utils/swap.utils';

export const useSwap = () => {
  const mavryk = useMavryk();
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
        mavryk,
        publicKeyHash
      ),
    [mavryk, publicKeyHash]
  );
};
