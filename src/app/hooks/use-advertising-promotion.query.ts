import { useQuery } from '@tanstack/react-query';

import { AdvertisingPromotion, fetchAdvertisingInfo } from 'lib/apis/temple';
import { miscKeys } from 'lib/query-keys';
import { useNetwork } from 'lib/temple/front';
import { useLastSeenPromotionName } from 'lib/store/zustand/ui.store';

export const useAdvertisingPromotionQuery = () => {
  const network = useNetwork();
  return useQuery({
    queryKey: miscKeys.advertisingPromo,
    queryFn: fetchAdvertisingInfo,
    enabled: network.type === 'main',
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false
  });
};

export const useActivePromotion = (): AdvertisingPromotion | undefined => {
  const { data } = useAdvertisingPromotionQuery();
  return data;
};

export const useIsNewPromotionAvailable = (): boolean => {
  const activePromotion = useActivePromotion();
  const lastSeenName = useLastSeenPromotionName();
  return lastSeenName !== activePromotion?.name;
};
