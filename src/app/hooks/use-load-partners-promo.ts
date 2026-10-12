import { OptimalPromoVariantEnum } from 'lib/apis/optimal';

import { usePartnersPromoQuery } from './use-partners-promo.query';

/** Compatibility entrypoint: observes the scoped cache without activating the disabled Optimal endpoint. */
export const useLoadPartnersPromo = (variant?: OptimalPromoVariantEnum) => {
  usePartnersPromoQuery(variant);
};
