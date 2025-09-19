import { fetchWithTimeout } from 'lib/apis/tzkt/utils';
import { toTokenSlug } from 'lib/assets';
import { MVRK_PRICE, RWA_ASSET_PRICES } from 'lib/constants';
import { fetchFromStorage, putToStorage } from 'lib/storage';

import { getDodoMavTokenPrices } from './dodoMav';
import { DodoStorageSchema, DEX_STORAGE_QUERY } from './queries';
import { templeWalletApi } from './templewallet.api';

interface GetExchangeRatesResponseItem {
  tokenAddress?: string;
  tokenId?: number;
  exchangeRate: string;
}

export const fetchUsdToTokenRates = async () => {
  const prices: StringRecord = {};
  const mvrkPrice = await getCMCPrice(process.env.CMC_PRICE_API_KEY ?? '');
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

async function getCMCPrice(apiKey: string, symbol = '$MVRK', convert = 'USD') {
  const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbol}&convert=${convert}`;

  try {
    const res = await fetch(url, {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey
      }
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }

    const { data } = (await res.json()) as { data: Record<string, any> };
    const tokenPrice = data?.[symbol]?.quote?.[convert]?.price ?? null;

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
