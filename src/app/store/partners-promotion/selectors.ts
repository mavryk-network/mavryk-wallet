import { useOwnedUI } from 'lib/store/zustand/ui-client';

import { useSelector } from '..';

export const usePartnersPromoSelector = () => useSelector(state => state.partnersPromotion.promotion);
export const useShouldShowPartnersPromoSelector = () => useOwnedUI(state => state.ui.shouldShowPromotion);

export const usePromotionHidingTimestampSelector = (id: string) =>
  useOwnedUI(state => state.ui.promotionHidingTimestamps[id] ?? 0);
