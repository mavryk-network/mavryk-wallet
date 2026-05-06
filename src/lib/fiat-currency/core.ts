import { useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
import { BigNumber } from 'bignumber.js';

import { useSelector } from 'app/store/root-state.selector';
import { COINGECKO_MVRK_ID, fetchCoingeckoRates } from 'lib/apis/temple';
import { useStorage } from 'lib/temple/front';
import { isTruthy } from 'lib/utils';

import { FIAT_CURRENCIES } from './consts';
import type { FiatCurrencyOption } from './types';

const FIAT_CURRENCY_STORAGE_KEY = 'fiat_currency';

export const useUsdToTokenRates = () => useSelector(state => state.currency.usdToTokenRates.data);

function useAssetUSDPrice(slug: string) {
  const usdToTokenRates = useUsdToTokenRates();

  return useMemo(() => {
    const rateStr = usdToTokenRates[slug];
    return rateStr ? Number(rateStr) : undefined;
  }, [slug, usdToTokenRates]);
}

export const useFiatToUsdRate = () => {
  const {
    fiatRates,
    selectedFiatCurrency: { name: selectedFiatCurrencyName }
  } = useFiatCurrency();

  return useMemo(() => {
    if (!isDefined(fiatRates)) return;

    const fiatRate = fiatRates[selectedFiatCurrencyName.toLowerCase()] ?? 1;
    const usdRate = fiatRates['usd'] ?? 1;

    return fiatRate / usdRate;
  }, [fiatRates, selectedFiatCurrencyName]);
};

export function useAssetFiatCurrencyPrice(slug: string): BigNumber {
  const fiatToUsdRate = useFiatToUsdRate();
  const usdToTokenRate = useAssetUSDPrice(slug);

  return useMemo(() => {
    if (!isTruthy(usdToTokenRate) || !isTruthy(fiatToUsdRate)) return new BigNumber(0);

    return BigNumber(fiatToUsdRate).times(usdToTokenRate);
  }, [fiatToUsdRate, usdToTokenRate]);
}

export const useFiatCurrency = () => {
  const { data } = useSelector(state => state.currency.fiatToTezosRates);

  const [selectedFiatCurrency, setSelectedFiatCurrency] = useStorage<FiatCurrencyOption>(
    FIAT_CURRENCY_STORAGE_KEY,
    FIAT_CURRENCIES[0]!
  );

  return {
    selectedFiatCurrency,
    setSelectedFiatCurrency,
    fiatRates: data
  };
};

export const fetchFiatToTezosRates = () =>
  fetchCoingeckoRates(
    COINGECKO_MVRK_ID,
    FIAT_CURRENCIES.map(({ apiLabel }) => apiLabel)
  );
