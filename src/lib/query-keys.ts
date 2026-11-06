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
  all: ['exchange-rates', 'coingecko-mavryk', 'dodo-mav'] as const,
  legacyFallback: ['exchange-rates', 'legacy-price-fallback'] as const
};

export const buyCardKeys = {
  all: ['buy-card'] as const,
  output: (provider: string, amount: number | undefined, inputs: unknown) =>
    ['buy-card', 'output', provider, amount ?? null, inputs] as const,
  currencies: (provider: string) => ['buy-card', 'currencies', provider] as const,
  limits: (fiat: string, crypto: string, provider: string, inputs: unknown) =>
    ['buy-card', 'limits', fiat, crypto, provider, inputs] as const
};

export const notificationKeys = {
  list: (startFromTime: number) => ['notifications', 'extension', startFromTime] as const
};

export const advertisingKeys = { active: ['advertising', 'temple', 'active'] as const };

export const partnerPromotionKeys = {
  decision: (account: string, variant: string) => ['partner-promotion', 'optimal', '1729', account, variant] as const
};

/** Durable data is owner-read; these keys contain only request lifecycle and synchronization receipts. */
export const assetsKeys = {
  account: (category: 'tokens' | 'collectibles' | 'rwas', account: string, chainId: string, networkId: string) =>
    ['account-assets', category, account, chainId, networkId] as const,
  security: (category: 'scamlist' | 'whitelist') => ['asset-security', 'madfish-mainnet', category] as const
};

/** Receipt-only metadata lifecycle; RPC selects a source independently of chain ID. */
export const metadataKeys = {
  scope: (category: string, scope: { account: string; chainId: string; networkId: string; rpcUrl: string }) =>
    ['metadata', category, scope.account, scope.chainId, scope.networkId, scope.rpcUrl] as const,
  batch: (
    category: string,
    scope: { account: string; chainId: string; networkId: string; rpcUrl: string },
    mode: string,
    slugs: string[]
  ) => [...metadataKeys.scope(category, scope), mode, 'batch', slugs] as const,
  receipt: (
    category: string,
    scope: { account: string; chainId: string; networkId: string; rpcUrl: string },
    mode: string,
    slug: string
  ) => [...metadataKeys.scope(category, scope), mode, 'receipt', slug] as const
};

/** Balance request receipts are isolated by every source input; durable values stay in the owner. */
export const balancesKeys = {
  scope: (scope: { account: string; chainId: string; networkId: string; rpcUrl: string }) =>
    ['balances', scope.account, scope.chainId, scope.networkId, scope.rpcUrl] as const,
  request: (scope: { account: string; chainId: string; networkId: string; rpcUrl: string }, category: string) =>
    [...balancesKeys.scope(scope), category] as const
};
