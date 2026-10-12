import { Route3SwapParamsRequestRaw } from 'lib/route3/interfaces';

type SwapParamsRequestKeyFields = {
  [K in keyof Route3SwapParamsRequestRaw]-?: Route3SwapParamsRequestRaw[K] | null;
};

const getSwapParamsRequestKeyFields = (params: Route3SwapParamsRequestRaw): SwapParamsRequestKeyFields => ({
  fromSymbol: params.fromSymbol,
  toSymbol: params.toSymbol,
  amount: params.amount ?? null,
  chainsLimit: params.chainsLimit ?? null
});

export const serializeQueryKey = (key: readonly unknown[]) => JSON.stringify(key) ?? '';

export const swapKeys = {
  tokens: ['swap', 'tokens'] as const,
  dexes: ['swap', 'dexes'] as const,
  allParams: ['swap', 'params'] as const,
  params: (account: string, chainId: string, params: Route3SwapParamsRequestRaw) => {
    const fields = getSwapParamsRequestKeyFields(params);

    return [
      ...swapKeys.allParams,
      account,
      chainId,
      fields.fromSymbol,
      fields.toSymbol,
      fields.amount,
      fields.chainsLimit
    ] as const;
  }
};

/** Details are isolated by account, chain and configured API network; slug sets never enter batch keys. */
export const assetDetailsKeys = {
  batch: (category: 'collectibles' | 'rwas', account: string, chainId: string, networkId: string) =>
    ['asset-details', category, 'batch', account, chainId, networkId] as const,
  leaf: (category: 'collectibles' | 'rwas', account: string, chainId: string, networkId: string, slug: string) =>
    ['asset-details', category, 'leaf', account, chainId, networkId, slug] as const
};

/** Fixed public feeds do not vary with the selected wallet or network. */
export const exchangeRateKeys = {
  all: ['exchange-rates', 'coingecko-mavryk', 'dodo-mav'] as const
};
