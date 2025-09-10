import { fetchWithTimeout } from 'lib/apis/tzkt/utils';
import { toTokenSlug } from 'lib/assets';
import { RWA_ASSET_PRICES } from 'lib/constants';
import { fetchFromStorage, putToStorage } from 'lib/storage';

import { getDodoMavTokenPrices } from './dodoMav';
import { DodoStorageSchema, DEX_STORAGE_QUERY } from './queries';
import { templeWalletApi } from './templewallet.api';

interface GetExchangeRatesResponseItem {
  tokenAddress?: string;
  tokenId?: number;
  exchangeRate: string;
}

export const fetchUsdToTokenRates = () =>
  templeWalletApi.get<GetExchangeRatesResponseItem[]>('/exchange-rates').then(({ data }) => {
    const prices: StringRecord = {};

    for (const { tokenAddress, tokenId, exchangeRate } of data) {
      if (tokenAddress) {
        prices[toTokenSlug(tokenAddress, tokenId)] = exchangeRate;
      } else {
        prices.mav = exchangeRate;
      }
    }

    return prices;
  });

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
