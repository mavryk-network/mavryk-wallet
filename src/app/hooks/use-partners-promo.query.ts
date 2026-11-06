import { useMemo } from 'react';

import { useAppEnv } from 'app/env';
import { mockPartnersPromotion } from 'app/store/partners-promotion/state.mock';
import { OptimalPromotionType, OptimalPromoVariantEnum } from 'lib/apis/optimal';
import { useDormantQuery } from 'lib/query/use-dormant-query';
import { partnerPromotionKeys } from 'lib/query-keys';
import { createEntity } from 'lib/store';
import { useAccountPkh } from 'lib/temple/front';

/** Optimal remains disabled. An unscoped legacy response cannot seed an account/variant-scoped decision. */
export const usePartnersPromoQuery = (variant?: OptimalPromoVariantEnum) => {
  const { popup } = useAppEnv();
  const account = useAccountPkh();
  const finalVariant = variant ?? (popup ? OptimalPromoVariantEnum.Popup : OptimalPromoVariantEnum.Fullview);
  return useDormantQuery<OptimalPromotionType>(partnerPromotionKeys.decision(account, finalVariant));
};

export const usePartnersPromo = (variant?: OptimalPromoVariantEnum) => {
  const query = usePartnersPromoQuery(variant);
  return useMemo(
    () => createEntity(query.data ?? mockPartnersPromotion, query.isFetching, query.error?.message),
    [query.data, query.isFetching, query.error]
  );
};
