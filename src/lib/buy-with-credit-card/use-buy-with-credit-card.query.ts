import { useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isDefined } from '@rnw-community/shared';

import {
  mapAliceBobProviderCurrencies,
  mapMoonPayProviderCurrencies,
  mapUtorgProviderCurrencies
} from './utils';
import { getMoonPayCurrencies } from 'lib/apis/moonpay';
import { getAliceBobPairsInfo } from 'lib/apis/temple';
import { getCurrenciesInfo as getUtorgCurrenciesInfo } from 'lib/apis/utorg';
import { LoadableEntityState } from './loadable-entity';
import { getAxiosQueryErrorMessage } from 'lib/utils/get-axios-query-error-message';

import { PAIR_NOT_FOUND_MESSAGE } from './constants';
import { getUpdatedFiatLimits } from './get-updated-fiat-limits';
import { TopUpProviderId } from './top-up-provider-id.enum';
import { TopUpInputInterface, TopUpOutputInterface, TopUpProviderPairLimits } from './topup.interface';

// --- Types ---

export interface TopUpProviderCurrencies {
  fiat: TopUpInputInterface[];
  crypto: TopUpOutputInterface[];
}

interface ProviderCurrenciesEntry {
  data: TopUpProviderCurrencies;
  error?: string;
}

export type AllProviderCurrencies = Record<TopUpProviderId, ProviderCurrenciesEntry>;

/** Per-provider pair limits for a single fiat/crypto pair (same shape as old Redux PairLimits) */
export type PairLimitsResult = Record<TopUpProviderId, LoadableEntityState<TopUpProviderPairLimits | undefined>>;

// --- Query keys ---

export const buyWithCreditCardKeys = {
  currencies: ['buy-with-credit-card', 'currencies'] as const,
  pairLimits: (fiat: string, crypto: string) =>
    ['buy-with-credit-card', 'pair-limits', fiat, crypto] as const,
  allPairLimits: ['buy-with-credit-card', 'pair-limits'] as const
};

// --- Fetch functions ---

const EMPTY_CURRENCIES: TopUpProviderCurrencies = { fiat: [], crypto: [] };

const ALL_PROVIDER_IDS = [TopUpProviderId.MoonPay, TopUpProviderId.Utorg, TopUpProviderId.AliceBob];

function settledToCurrencyEntry(
  result: PromiseSettledResult<TopUpProviderCurrencies>
): ProviderCurrenciesEntry {
  if (result.status === 'fulfilled') {
    return { data: result.value };
  }
  console.error(result.reason);
  return { data: EMPTY_CURRENCIES, error: getAxiosQueryErrorMessage(result.reason) };
}

async function fetchAllProviderCurrencies(): Promise<AllProviderCurrencies> {
  const [moonpay, utorg, aliceBob] = await Promise.allSettled([
    getMoonPayCurrencies().then(mapMoonPayProviderCurrencies),
    getUtorgCurrenciesInfo().then(mapUtorgProviderCurrencies),
    getAliceBobPairsInfo(false).then(mapAliceBobProviderCurrencies)
  ]);

  return {
    [TopUpProviderId.MoonPay]: settledToCurrencyEntry(moonpay),
    [TopUpProviderId.Utorg]: settledToCurrencyEntry(utorg),
    [TopUpProviderId.AliceBob]: settledToCurrencyEntry(aliceBob)
  };
}

async function fetchPairLimits(
  fiatSymbol: string,
  cryptoSymbol: string,
  currencies: AllProviderCurrencies,
  prevResult?: PairLimitsResult
): Promise<PairLimitsResult> {
  const results = await Promise.all(
    ALL_PROVIDER_IDS.map(
      async (providerId): Promise<LoadableEntityState<TopUpProviderPairLimits | undefined>> => {
        const { fiat: fiatCurrencies, crypto: cryptoCurrencies } = currencies[providerId].data;

        if (fiatCurrencies.length < 1 || cryptoCurrencies.length < 1) {
          return { data: undefined, isLoading: false };
        }

        const prevEntry = prevResult?.[providerId];
        if (prevEntry?.error === PAIR_NOT_FOUND_MESSAGE) {
          return { data: undefined, isLoading: false, error: PAIR_NOT_FOUND_MESSAGE };
        }

        const fiatCurrency = fiatCurrencies.find(({ code }) => code === fiatSymbol);
        const cryptoCurrency = cryptoCurrencies.find(({ code }) => code === cryptoSymbol);

        if (isDefined(fiatCurrency) && isDefined(cryptoCurrency)) {
          return getUpdatedFiatLimits(fiatCurrency, cryptoCurrency, providerId);
        }

        return { data: undefined, isLoading: false, error: PAIR_NOT_FOUND_MESSAGE };
      }
    )
  );

  return {
    [TopUpProviderId.MoonPay]: results[0],
    [TopUpProviderId.Utorg]: results[1],
    [TopUpProviderId.AliceBob]: results[2]
  };
}

// --- Query hooks ---

export const useAllProviderCurrenciesQuery = () =>
  useQuery({
    queryKey: buyWithCreditCardKeys.currencies,
    queryFn: fetchAllProviderCurrencies,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false
  });

export const usePairLimitsQuery = (fiatSymbol: string, cryptoSymbol: string) => {
  const { data: currencies } = useAllProviderCurrenciesQuery();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: buyWithCreditCardKeys.pairLimits(fiatSymbol, cryptoSymbol),
    queryFn: () => {
      const prevResult = queryClient.getQueryData<PairLimitsResult>(
        buyWithCreditCardKeys.pairLimits(fiatSymbol, cryptoSymbol)
      );
      return fetchPairLimits(fiatSymbol, cryptoSymbol, currencies!, prevResult);
    },
    enabled: !!currencies && fiatSymbol.length > 0 && cryptoSymbol.length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });
};

// --- Selector-equivalent hooks (currencies) ---

const EMPTY_FIAT: TopUpInputInterface[] = [];
const EMPTY_CRYPTO: TopUpOutputInterface[] = [];

export const useCurrenciesLoading = () => {
  const { isLoading } = useAllProviderCurrenciesQuery();
  return isLoading;
};

export const useFiatCurrencies = (providerId: TopUpProviderId) => {
  const { data } = useAllProviderCurrenciesQuery();
  return data?.[providerId]?.data.fiat ?? EMPTY_FIAT;
};

export const useCryptoCurrencies = (providerId: TopUpProviderId) => {
  const { data } = useAllProviderCurrenciesQuery();
  return data?.[providerId]?.data.crypto ?? EMPTY_CRYPTO;
};

export const useProviderCurrenciesError = (providerId: TopUpProviderId) => {
  const { data } = useAllProviderCurrenciesQuery();
  return data?.[providerId]?.error;
};

export const useCurrenciesErrors = () => {
  const { data } = useAllProviderCurrenciesQuery();
  return useMemo(
    () => ({
      [TopUpProviderId.MoonPay]: data?.[TopUpProviderId.MoonPay]?.error,
      [TopUpProviderId.Utorg]: data?.[TopUpProviderId.Utorg]?.error,
      [TopUpProviderId.AliceBob]: data?.[TopUpProviderId.AliceBob]?.error
    }),
    [data]
  );
};

// --- Selector-equivalent hooks (pair limits) ---

export const usePairLimitsData = (fiatSymbol: string, cryptoSymbol: string) => {
  const { data } = usePairLimitsQuery(fiatSymbol, cryptoSymbol);
  return data;
};

export const useProviderPairLimitsData = (
  fiatSymbol: string,
  cryptoSymbol: string,
  providerId: TopUpProviderId
) => {
  const data = usePairLimitsData(fiatSymbol, cryptoSymbol);
  return data?.[providerId];
};

export const usePairLimitsErrors = (fiatSymbol: string, cryptoSymbol: string) => {
  const data = usePairLimitsData(fiatSymbol, cryptoSymbol);
  return useMemo(
    () => ({
      [TopUpProviderId.MoonPay]: data?.[TopUpProviderId.MoonPay]?.error,
      [TopUpProviderId.Utorg]: data?.[TopUpProviderId.Utorg]?.error,
      [TopUpProviderId.AliceBob]: data?.[TopUpProviderId.AliceBob]?.error
    }),
    [data]
  );
};

export const usePairLimitsAreLoadingQuery = (fiatSymbol: string, cryptoSymbol: string) => {
  const { isFetching } = usePairLimitsQuery(fiatSymbol, cryptoSymbol);
  return isFetching;
};

/** Synchronous cache read for pair limits (for use in callbacks, not reactive) */
export const usePairLimitsFromCache = () => {
  const queryClient = useQueryClient();
  return (fiatSymbol: string, cryptoSymbol: string) =>
    queryClient.getQueryData<PairLimitsResult>(buyWithCreditCardKeys.pairLimits(fiatSymbol, cryptoSymbol));
};
