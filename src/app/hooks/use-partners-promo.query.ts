import { useQuery } from '@tanstack/react-query';

import { OptimalPromotionType, OptimalPromoVariantEnum, fetchOptimalPromotion } from 'lib/apis/optimal';
import { miscKeys } from 'lib/query-keys';
import { useAccountPkh } from 'lib/temple/front';

import { useAppEnv } from '../env';

interface PartnersPromoQueryOptions {
  variant?: OptimalPromoVariantEnum;
  enabled?: boolean;
}

export const usePartnersPromoQuery = (options: PartnersPromoQueryOptions = {}) => {
  const { popup } = useAppEnv();
  const accountAddress = useAccountPkh();
  const { variant, enabled = true } = options;
  const finalVariant = variant ?? (popup ? OptimalPromoVariantEnum.Popup : OptimalPromoVariantEnum.Fullview);

  return useQuery({
    queryKey: miscKeys.partnersPromo(finalVariant, accountAddress),
    queryFn: () => fetchOptimalPromotion(finalVariant, accountAddress),
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false
  });
};

export const usePartnersPromoData = (): {
  data: OptimalPromotionType;
  error: string | undefined;
  isLoading: boolean;
} => {
  const { data, error, isLoading } = usePartnersPromoQuery();
  const defaultData: OptimalPromotionType = {};
  return {
    data: data ?? defaultData,
    error: error ? String(error) : undefined,
    isLoading
  };
};
