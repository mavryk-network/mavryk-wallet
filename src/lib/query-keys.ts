/**
 * Centralized TanStack Query key factory.
 *
 * Every query key in the app should be defined here to prevent
 * cross-file duplication and ensure invalidation correctness.
 *
 * Convention: keys are grouped by domain, using `as const` for type safety.
 */

// --- Balance & Chain ---

export const balanceKeys = {
  all: ['balance'] as const,
  one: (checksum: string, slug: string, pkh: string) => ['balance', checksum, slug, pkh] as const,
  mav: (checksum: string, pkh: string) => ['balance', checksum, 'mav', pkh] as const
};

export const chainKeys = {
  id: (rpcUrl: string) => ['chain-id', rpcUrl] as const,
  delegate: (checksum: string, pkh: string) => ['delegate', checksum, pkh] as const,
  delegateStats: (checksum: string, pkh: string) => ['delegate_stats', checksum, pkh] as const
};

// --- Storage ---

export const storageKeys = {
  one: (key: string) => ['storage', key] as const
};

// --- Baking ---

export const bakingKeys = {
  baker: (address: string, chainId: string) => ['baker', address, chainId] as const,
  bakers: (baseApiUrl: string) => ['bakers', baseApiUrl] as const,
  history: (pkh: string, bakerPkh: string, chainId: string) =>
    ['baking-history', pkh, bakerPkh, chainId] as const
};

// --- DApps ---

export const dAppKeys = {
  sessions: ['getAllDAppSessions'] as const,
  payload: (id: string) => ['getDAppPayload', id] as const,
  list: ['dapps-list'] as const
};

// --- Swap ---

export const swapKeys = {
  tokens: ['swap', 'tokens'] as const,
  dexes: ['swap', 'dexes'] as const,
  params: (fromSymbol: string, toSymbol: string, amount: string) =>
    ['swap', 'params', fromSymbol, toSymbol, amount] as const,
  allParams: ['swap', 'params'] as const
};

// --- Buy with Credit Card ---

export const buyWithCreditCardKeys = {
  currencies: ['buy-with-credit-card', 'currencies'] as const,
  pairLimits: (fiat: string, crypto: string) =>
    ['buy-with-credit-card', 'pair-limits', fiat, crypto] as const,
  allPairLimits: ['buy-with-credit-card', 'pair-limits'] as const
};

// --- Tokens & Metadata ---

export const tokensKeys = {
  apy: ['tokens-apy'] as const,
  exchangeRates: ['exchange-rates'] as const,
  collectiblesDetails: ['collectibles-details'] as const,
  rwasDetails: ['rwas-details'] as const,
  collectibleExtra: (contractAddress: string, tokenId: string) =>
    ['fetchCollectibleExtraDetails', contractAddress, tokenId] as const
};

// --- Tezos Domains ---

export const tzdnsKeys = {
  address: (checksum: string, domainName: string) => ['tzdns-address', checksum, domainName] as const,
  reverseName: (address: string, checksum: string) => ['tzdns-reverse-name', address, checksum] as const
};

// --- Fee Estimation ---

export const feeKeys = {
  transferBase: (checksum: string, assetSlug: string, pkh: string, toResolved: string) =>
    ['transfer-base-fee', checksum, assetSlug, pkh, toResolved] as const,
  stakeBase: (mode: string, checksum: string, pkh: string, amount: string) =>
    ['stake-base-fee', mode, checksum, pkh, amount] as const,
  delegateBase: (checksum: string, pkh: string, toResolved: string) =>
    ['delegate-base-fee', checksum, pkh, toResolved] as const
};

// --- Misc ---

export const miscKeys = {
  advertisingPromo: ['advertising-promotion'] as const,
  partnersPromo: (variant: string, accountAddress: string) =>
    ['partners-promo', variant, accountAddress] as const,
  contentToParse: (payloadType: string, discriminator: string | null) =>
    ['content-to-parse', payloadType, discriminator] as const,
  i18n: ['i18n'] as const,
  awaitFonts: (name: string, weights: number[], className: string) =>
    ['awaitFonts', name, weights, className] as const,
  exolixCurrencies: ['exolix/api/currencies'] as const,
  exolixRate: (coinFrom: string, coinTo: string, amount: string) =>
    ['exolix/api/rate', coinFrom, coinTo, amount] as const
};
