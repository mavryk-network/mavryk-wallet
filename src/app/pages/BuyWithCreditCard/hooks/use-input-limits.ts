import { useMemo } from 'react';

import {
  usePairLimitsAreLoadingQuery,
  useProviderPairLimitsData
} from 'lib/buy-with-credit-card/use-buy-with-credit-card.query';
import { TopUpProviderId } from 'lib/buy-with-credit-card/top-up-provider-id.enum';
import { TopUpProviderPairLimits } from 'lib/buy-with-credit-card/topup.interface';

export const useInputLimits = (
  topUpProvider: TopUpProviderId,
  fiatCurrencyCode: string,
  cryptoCurrencyCode: string
): Partial<TopUpProviderPairLimits> => {
  const pairLimits = useProviderPairLimitsData(fiatCurrencyCode, cryptoCurrencyCode, topUpProvider);

  return useMemo(() => pairLimits?.data ?? {}, [pairLimits]);
};

export const usePairLimitsAreLoading = (fiatCurrencyCode: string, cryptoCurrencyCode: string) =>
  usePairLimitsAreLoadingQuery(fiatCurrencyCode, cryptoCurrencyCode);
