import { useQuery } from '@tanstack/react-query';

import { ExchangeRateInterface } from 'app/store/currency/actions';
import { fetchUsdToTokenRates, fetchRWAToUsdtRates } from 'lib/apis/temple';
import { fetchFiatToTezosRates } from 'lib/fiat-currency';
import { RATES_SYNC_INTERVAL } from 'lib/fixed-times';
import { exchangeRateKeys } from 'lib/query-keys';

const EMPTY_RATES: ExchangeRateInterface = { usdToTokenRates: {}, fiatToTezosRates: {} };

/** Preserve the existing all-feed publication and RWA-over-token precedence. */
export async function fetchExchangeRates(): Promise<ExchangeRateInterface> {
  const [usdToTokenRates, fiatToTezosRates, rwaRates] = await Promise.all([
    fetchUsdToTokenRates(),
    fetchFiatToTezosRates(),
    fetchRWAToUsdtRates()
  ]);
  return { usdToTokenRates: { ...usdToTokenRates, ...rwaRates }, fiatToTezosRates };
}

/** Only the app driver polls; valuation readers subscribe without initiating requests. */
export const useExchangeRatesQuery = (isDriver = false) =>
  useQuery({
    queryKey: exchangeRateKeys.all,
    queryFn: fetchExchangeRates,
    enabled: isDriver,
    staleTime: RATES_SYNC_INTERVAL,
    cacheTime: 5 * 60_000,
    refetchInterval: isDriver ? RATES_SYNC_INTERVAL : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

export const useExchangeRates = () => useExchangeRatesQuery().data ?? EMPTY_RATES;
