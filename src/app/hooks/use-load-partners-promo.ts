import { OptimalPromoVariantEnum } from 'lib/apis/optimal';
import { useShouldShowPromotion } from 'lib/store/zustand/ui.store';

import { usePartnersPromoQuery } from './use-partners-promo.query';

/**
 * Loads partners promo if it should be shown.
 * TanStack Query handles fetching and caching automatically.
 */
export const useLoadPartnersPromo = (variant?: OptimalPromoVariantEnum) => {
  const shouldShow = useShouldShowPromotion();

  usePartnersPromoQuery({ variant, enabled: shouldShow });
};
