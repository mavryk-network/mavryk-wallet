import { usePartnersPromo } from 'app/hooks/use-partners-promo.query';
import { useOwnedUI } from 'lib/store/zustand/ui-client';

export const usePartnersPromoSelector = usePartnersPromo;
export const useShouldShowPartnersPromoSelector = () => useOwnedUI(state => state.ui.shouldShowPromotion);

export const usePromotionHidingTimestampSelector = (id: string) =>
  useOwnedUI(state => state.ui.promotionHidingTimestamps[id] ?? 0);
