import { useAdvertisingPromotionQuery } from './use-advertising-promotion.query';

/**
 * Global loading hook for advertising promotion data.
 * TanStack Query handles fetching and caching automatically.
 */
export const useAdvertisingLoading = () => {
  useAdvertisingPromotionQuery();
};
