import { useTokensApyQuery } from './use-tokens-apy.query';

/**
 * Global loading hook for tokens APY data.
 * TanStack Query handles the fetching, caching, and refetching automatically.
 * This hook exists to maintain the same call-site interface as before.
 */
export const useTokensApyLoading = () => {
  useTokensApyQuery();
};
