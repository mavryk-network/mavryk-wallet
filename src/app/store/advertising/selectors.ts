import { useOwnedUI } from 'lib/store/zustand/ui-client';

import { useSelector } from '../index';

export const useActivePromotionSelector = () => useSelector(({ advertising }) => advertising.activePromotion.data);

export const useIsNewPromotionAvailableSelector = () => {
  const lastSeen = useOwnedUI(({ ui }) => ui.lastSeenPromotionName);
  const promotion = useActivePromotionSelector();
  return lastSeen !== promotion?.name;
};
