import { KNOWN_TOKENS_SLUGS } from 'lib/assets/known-tokens';

// Yupana APY integration removed — endpoint deprecated.
// APY rates return 0 until a replacement data source is configured.

const EMPTY_APY: Record<string, number> = {
  [KNOWN_TOKENS_SLUGS.TZBTC]: 0,
  [KNOWN_TOKENS_SLUGS.KUSD]: 0,
  [KNOWN_TOKENS_SLUGS.USDT]: 0
};

export const useTokensApyQuery = () => ({ data: EMPTY_APY, isLoading: false, isError: false });

export const useTokensApyRates = (): Record<string, number> => EMPTY_APY;
