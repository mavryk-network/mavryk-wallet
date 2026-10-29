import { useQuery } from '@tanstack/react-query';

import { ExchangeRateInterface } from 'app/store/currency/actions';
import { useSelector } from 'app/store/root-state.selector';
import { fetchFreshUsdToTokenRates, fetchFreshRWAToUsdtRates } from 'lib/apis/temple';
import { MVRK_PRICE, RWA_ASSET_PRICES } from 'lib/constants';
import { fetchFiatToTezosRates } from 'lib/fiat-currency';
import { RATES_SYNC_INTERVAL } from 'lib/fixed-times';
import { exchangeRateKeys } from 'lib/query-keys';
import { fetchFromStorage } from 'lib/storage';

const EMPTY_RATES: ExchangeRateInterface = { usdToTokenRates: {}, fiatToTezosRates: {} };

/** Preserve the existing all-feed publication and RWA-over-token precedence. */
export async function fetchExchangeRates(): Promise<ExchangeRateInterface> {
  const [usdToTokenRates, fiatToTezosRates, rwaRates] = await Promise.all([
    fetchFreshUsdToTokenRates(),
    fetchFiatToTezosRates(),
    fetchFreshRWAToUsdtRates()
  ]);
  return { usdToTokenRates: { ...usdToTokenRates, ...rwaRates }, fiatToTezosRates };
}

/** Read retained price fallbacks once; never refresh their durable copies from server results. */
async function readLegacyRateFallback(): Promise<ExchangeRateInterface> {
  const [mav, rwa] = await Promise.all([
    fetchFromStorage<string>(MVRK_PRICE),
    fetchFromStorage<Record<string, string>>(RWA_ASSET_PRICES)
  ]);
  return { usdToTokenRates: { mav: String(Number(mav) || 0), ...(rwa ?? {}) }, fiatToTezosRates: {} };
}

/** Only the app driver polls; valuation readers subscribe without initiating requests. */
export const useExchangeRatesQuery = (isDriver = false) => {
  const legacy = useSelector(state => state.currency);
  const fallback = useQuery({
    queryKey: exchangeRateKeys.legacyFallback,
    queryFn: readLegacyRateFallback,
    enabled: isDriver,
    staleTime: Infinity,
    cacheTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
  const query = useQuery({
    queryKey: exchangeRateKeys.all,
    queryFn: fetchExchangeRates,
    initialData: () =>
      Object.keys(legacy.usdToTokenRates.data).length || Object.keys(legacy.fiatToTezosRates.data).length
        ? { usdToTokenRates: legacy.usdToTokenRates.data, fiatToTezosRates: legacy.fiatToTezosRates.data }
        : undefined,
    initialDataUpdatedAt: 0,
    enabled: isDriver,
    staleTime: RATES_SYNC_INTERVAL,
    cacheTime: 5 * 60_000,
    refetchInterval: isDriver ? RATES_SYNC_INTERVAL : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });
  return { ...query, data: query.data ?? fallback.data, fallbackError: fallback.error };
};

export const useExchangeRates = () => useExchangeRatesQuery().data ?? EMPTY_RATES;
