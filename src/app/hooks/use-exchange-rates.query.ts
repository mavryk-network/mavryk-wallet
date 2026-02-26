import { useQuery } from '@tanstack/react-query';

import { fetchUsdToTokenRates, fetchRWAToUsdtRates } from 'lib/apis/temple';
import { fetchFiatToTezosRates } from 'lib/fiat-currency';
import { RATES_SYNC_INTERVAL } from 'lib/fixed-times';

export type ExchangeRateRecord<V = string> = Record<string, V>;

interface ExchangeRatesData {
  usdToTokenRates: ExchangeRateRecord;
  fiatToTezosRates: ExchangeRateRecord<number>;
}

const fetchAllExchangeRates = async (): Promise<ExchangeRatesData> => {
  const [usdToTokenRates, fiatToTezosRates, rwasToUsdtRates] = await Promise.all([
    fetchUsdToTokenRates(),
    fetchFiatToTezosRates(),
    fetchRWAToUsdtRates()
  ]);

  return {
    usdToTokenRates: {
      ...usdToTokenRates,
      ...rwasToUsdtRates
    },
    fiatToTezosRates
  };
};

export const useExchangeRatesQuery = () => {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: fetchAllExchangeRates,
    staleTime: RATES_SYNC_INTERVAL,
    refetchInterval: RATES_SYNC_INTERVAL,
    refetchOnWindowFocus: false
  });
};

export const useUsdToTokenRatesData = (): ExchangeRateRecord => {
  const { data } = useExchangeRatesQuery();
  return data?.usdToTokenRates ?? {};
};

export const useFiatToTezosRatesData = (): ExchangeRateRecord<number> => {
  const { data } = useExchangeRatesQuery();
  return data?.fiatToTezosRates ?? {};
};
