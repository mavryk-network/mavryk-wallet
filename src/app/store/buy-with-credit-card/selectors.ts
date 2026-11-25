import { useMemo } from 'react';

import { TopUpProviderId } from 'lib/buy-with-credit-card/top-up-provider-id.enum';
import {
  useProviderCurrencies,
  useProviderLimits,
  useAllCachedPairLimits
} from 'lib/buy-with-credit-card/use-buy-with-credit-card.query';

import { PairLimits } from './state';

export const useProviderCurrenciesErrorSelector = (topUpProvider: TopUpProviderId) =>
  useProviderCurrencies(topUpProvider).error;

export const useFiatCurrenciesSelector = (topUpProvider: TopUpProviderId) =>
  useProviderCurrencies(topUpProvider).data.fiat;

export const useCryptoCurrenciesSelector = (topUpProvider: TopUpProviderId) =>
  useProviderCurrencies(topUpProvider).data.crypto;

const useCurrenciesByProviderLoadingSelector = (topUpProvider: TopUpProviderId) =>
  useProviderCurrencies(topUpProvider).isLoading;

export const useCurrenciesLoadingSelector = () => {
  const moonPayLoading = useCurrenciesByProviderLoadingSelector(TopUpProviderId.MoonPay);
  const utorgLoading = useCurrenciesByProviderLoadingSelector(TopUpProviderId.Utorg);
  const aliceBobLoading = useCurrenciesByProviderLoadingSelector(TopUpProviderId.AliceBob);

  return moonPayLoading || utorgLoading || aliceBobLoading;
};

const useCurrenciesErrorSelector = (topUpProvider: TopUpProviderId) => useProviderCurrencies(topUpProvider).error;

export const useCurrenciesErrorsSelector = () => {
  const moonPayError = useCurrenciesErrorSelector(TopUpProviderId.MoonPay);
  const utorgError = useCurrenciesErrorSelector(TopUpProviderId.Utorg);
  const aliceBobError = useCurrenciesErrorSelector(TopUpProviderId.AliceBob);

  return useMemo(
    () => ({
      [TopUpProviderId.MoonPay]: moonPayError,
      [TopUpProviderId.Utorg]: utorgError,
      [TopUpProviderId.AliceBob]: aliceBobError
    }),
    [moonPayError, utorgError, aliceBobError]
  );
};

export const useAllPairsLimitsSelector = useAllCachedPairLimits;

export const usePairLimitsSelector = (fiat: string, crypto: string): PairLimits => {
  const moonpay = useProviderLimits(fiat, crypto, TopUpProviderId.MoonPay);
  const utorg = useProviderLimits(fiat, crypto, TopUpProviderId.Utorg);
  const aliceBob = useProviderLimits(fiat, crypto, TopUpProviderId.AliceBob);
  return useMemo(
    () => ({
      [TopUpProviderId.MoonPay]: moonpay,
      [TopUpProviderId.Utorg]: utorg,
      [TopUpProviderId.AliceBob]: aliceBob
    }),
    [moonpay, utorg, aliceBob]
  );
};
export const useProviderPairLimitsSelector = useProviderLimits;
const usePairLimitsErrorSelector = (fiat: string, crypto: string, provider: TopUpProviderId) =>
  useProviderLimits(fiat, crypto, provider).error;

export const usePairLimitsErrorsSelector = (fiatSymbol: string, cryptoSymbol: string) => {
  const moonPayError = usePairLimitsErrorSelector(fiatSymbol, cryptoSymbol, TopUpProviderId.MoonPay);
  const utorgError = usePairLimitsErrorSelector(fiatSymbol, cryptoSymbol, TopUpProviderId.Utorg);
  const aliceBobError = usePairLimitsErrorSelector(fiatSymbol, cryptoSymbol, TopUpProviderId.AliceBob);

  return useMemo(
    () => ({
      [TopUpProviderId.MoonPay]: moonPayError,
      [TopUpProviderId.Utorg]: utorgError,
      [TopUpProviderId.AliceBob]: aliceBobError
    }),
    [moonPayError, utorgError, aliceBobError]
  );
};
