import { fetchWithTimeout } from 'lib/apis/tzkt/utils';
import { toTokenSlug } from 'lib/assets';
import { MVRK_PRICE, RWA_ASSET_PRICES } from 'lib/constants';
import { fetchFromStorage, putToStorage } from 'lib/storage';

import { getDodoMavTokenPrices } from './dodoMav';
import { DodoStorageSchema, DEX_STORAGE_QUERY } from './queries';
import { templeWalletApi } from './templewallet.api';

const coingecko_api = process.env.COINGECKO_API;
const coingecko_api_key = process.env.COINGECKO_API_KEY;

interface GetExchangeRatesResponseItem {
  tokenAddress?: string;
  tokenId?: number;
  exchangeRate: string;
}

export type CMCResponse = {
  [symbol: string]: {
    [currency: string]: number;
  };
};

export const fetchUsdToTokenRates = async () => {
  const prices: StringRecord = {};
  const mvrkPrice = await getCoingeckoPrice();
  prices.mav = mvrkPrice;

  return templeWalletApi.get<GetExchangeRatesResponseItem[]>('/exchange-rates').then(({ data }) => {
    for (const { tokenAddress, tokenId, exchangeRate } of data) {
      if (tokenAddress) {
        prices[toTokenSlug(tokenAddress, tokenId)] = exchangeRate;
      }
    }

    return prices;
  });
};

export const COINGECKO_MVRK_ID = 'mavryk-network';

export async function getCoingeckoPrice(id = COINGECKO_MVRK_ID, currency = 'USD') {
  const url = `${coingecko_api}/simple/price?vs_currencies=${currency}&ids=${id}`;

  try {
    const res = await fetch(url, {
      // @ts-expect-error // api key
      headers: {
        'x-cg-demo-api-key': coingecko_api_key
      }
    });

    const {
      [COINGECKO_MVRK_ID]: { usd: tokenPrice }
    } = (await res.json()) as CMCResponse;

    await putToStorage(MVRK_PRICE, tokenPrice);

    return tokenPrice;
  } catch (err) {
    console.error('Error fetching price:', err);
    const cachedPrice = fetchFromStorage<StringRecord<string>>(MVRK_PRICE);
    return cachedPrice ?? 0;
  }
}

// api rwa metadata utils
export const fetchRWAToUsdtRates = async (): Promise<Record<string, string>> => {
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
    const cachedPrices = fetchFromStorage<StringRecord<string>>(RWA_ASSET_PRICES);
    // @ts-expect-error // null as price won't esist
    return cachedPrices ?? {};
  }
};
