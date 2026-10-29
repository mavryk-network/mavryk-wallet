import { isDefined } from '@rnw-community/shared';

import type { SwapState } from './state';

export const getSwapParamsData = (swapParams: SwapState['swapParams']) => {
  const hasResolvedQuoteData = isDefined(swapParams.data.input) || isDefined(swapParams.data.output);

  return {
    ...swapParams,
    isFetching: swapParams.isLoading,
    isLoading: swapParams.isLoading && !hasResolvedQuoteData
  };
};
