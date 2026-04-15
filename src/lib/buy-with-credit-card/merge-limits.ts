import { isDefined } from '@rnw-community/shared';

import type { PairLimitsResult } from 'lib/buy-with-credit-card/use-buy-with-credit-card.query';
import { isTruthy } from 'lib/utils';

import { TopUpProviderPairLimits } from './topup.interface';

export const mergeProvidersLimits = (limits: PairLimitsResult | undefined) => {
  if (!isDefined(limits)) return {};

  const limitsArray = Object.values(limits)
    .map(item => item.data)
    .filter(isTruthy);

  return limitsArray.reduce<Partial<TopUpProviderPairLimits>>((result, limits) => {
    const { min, max } = limits;

    if (isDefined(min)) {
      result.min = Math.min(result.min ?? Infinity, min);
    }
    if (isDefined(max)) {
      result.max = Math.max(result.max ?? 0, max);
    }

    return result;
  }, {});
};
