import { useAdvertisingPromotionQuery } from 'app/hooks/use-advertising-promotion.query';
import { useOwnedUI } from 'lib/store/zustand/ui-client';

export const useActivePromotionSelector = () => useAdvertisingPromotionQuery().data;

export const useIsNewPromotionAvailableSelector = () => {
  const lastSeen = useOwnedUI(({ ui }) => ui.lastSeenPromotionName);
  const promotion = useActivePromotionSelector();
  return lastSeen !== promotion?.name;
};
