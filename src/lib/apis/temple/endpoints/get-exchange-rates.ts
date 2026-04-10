import { fetchWithTimeout } from 'lib/apis/mvkt/utils';
import { MVRK_PRICE, RWA_ASSET_PRICES } from 'lib/constants';
import { IS_DEV_ENV } from 'lib/env';
import { fetchFromStorage, putToStorage } from 'lib/storage';

import { getDodoMavTokenPrices } from './dodoMav';
import { DodoStorageSchema, DEX_STORAGE_QUERY } from './queries';

const coingecko_api = process.env.COINGECKO_API;
const coingecko_api_key = process.env.COINGECKO_API_KEY;

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

export async function getCoingeckoPrice(id = COINGECKO_MVRK_ID, currency = 'USD') {
  if (!coingecko_api) return 0;

  const endpoint = new URL('/simple/price', coingecko_api);
  endpoint.searchParams.set('vs_currencies', currency.toLowerCase());
  endpoint.searchParams.set('ids', id);
  const url = endpoint.toString();

  try {
    const res = await fetch(url, {
      headers: {
        ...(coingecko_api_key ? { 'x-cg-pro-api-key': coingecko_api_key } : {})
      }
    });

    if (!res.ok) {
      throw new Error(`Coingecko request failed: ${res.status}`);
    }

    const json = (await res.json()) as CMCResponse;
    const tokenPrice = json[COINGECKO_MVRK_ID]?.[currency.toLowerCase()];

    if (tokenPrice == null) return 0;

    await putToStorage(MVRK_PRICE, tokenPrice);

    return tokenPrice || 0;
  } catch (err) {
    if (IS_DEV_ENV) console.error('[coingecko] Error fetching price:', err);
    const cachedPrice = await fetchFromStorage<string>(MVRK_PRICE);
    return Number(cachedPrice) || 0;
  }
}

// api rwa metadata utils
export const fetchRWAToUsdtRates = async (): Promise<Record<string, string>> => {
  if (!process.env.EXTERNAL_API) {
    const cachedPrices = await fetchFromStorage<StringRecord<string>>(RWA_ASSET_PRICES);
    return (cachedPrices ?? {}) as Record<string, string>;
  }

  try {
    const response = await fetchWithTimeout(`${process.env.EXTERNAL_API}`, {
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

    if (!data) {
      const cachedPrices = await fetchFromStorage<StringRecord<string>>(RWA_ASSET_PRICES);
      return (cachedPrices ?? {}) as Record<string, string>;
    }

    const parsedData = DodoStorageSchema.parse(data);

    const rwasAssetsPricesPair = getDodoMavTokenPrices(parsedData.dodo_mav);

    await putToStorage(RWA_ASSET_PRICES, rwasAssetsPricesPair);

    return { ...rwasAssetsPricesPair };
  } catch (e) {
    if (IS_DEV_ENV) console.error('[rwa] fetchRWAToUsdtRates error:', e);
    const cachedPrices = await fetchFromStorage<StringRecord<string>>(RWA_ASSET_PRICES);
    return (cachedPrices ?? {}) as Record<string, string>;
  }
};
