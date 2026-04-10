import { fetchWithTimeout } from 'lib/apis/mvkt/utils';
import { MVRK_PRICE, RWA_ASSET_PRICES } from 'lib/constants';
import { fetchFromStorage, putToStorage } from 'lib/storage';

import { getDodoMavTokenPrices } from './dodoMav';
import { DodoStorageSchema, DEX_STORAGE_QUERY } from './queries';

export type CMCResponse = {
  [symbol: string]: {
    [currency: string]: number;
  };
};

export const fetchUsdToTokenRates = async () => {
  const prices: StringRecord = {};
  const mvrkPrice = await getCoingeckoPrice();
  prices.mav = String(mvrkPrice);

  return prices;
};

export const COINGECKO_MVRK_ID = 'mavryk-network';

// TODO: Coingecko fetch disabled — was returning 429 (rate limited). Re-enable when API key/plan is resolved.
export async function getCoingeckoPrice(_id = COINGECKO_MVRK_ID, _currency = 'USD') {
  const cachedPrice = await fetchFromStorage<string>(MVRK_PRICE);
  return Number(cachedPrice) || 0;
}

// api rwa metadata utils
export const fetchRWAToUsdtRates = async (): Promise<Record<string, string>> => {
  if (!process.env.EXTERNAL_API) {
    const cachedPrices = await fetchFromStorage<StringRecord<string>>(RWA_ASSET_PRICES);
    return (cachedPrices ?? {}) as Record<string, string>;
  }

  try {
    const response = await fetchWithTimeout(`${process.env.EXTERNAL_API}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: DEX_STORAGE_QUERY
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const { data } = await response.json();

    const parsedData = DodoStorageSchema.parse(data);

    const rwasAssetsPricesPair = getDodoMavTokenPrices(parsedData.dodo_mav);

    await putToStorage(RWA_ASSET_PRICES, rwasAssetsPricesPair);

    return { ...rwasAssetsPricesPair };
  } catch (e) {
    console.error('Equittez RWA_PRICES_QUERY error', e);
    const cachedPrices = await fetchFromStorage<StringRecord<string>>(RWA_ASSET_PRICES);
    return (cachedPrices ?? {}) as Record<string, string>;
  }
};
