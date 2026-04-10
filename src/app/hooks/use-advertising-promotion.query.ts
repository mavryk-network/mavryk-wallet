import { useQuery } from '@tanstack/react-query';

import { AdvertisingPromotion, fetchAdvertisingInfo } from 'lib/apis/temple';
import { miscKeys, storageKeys } from 'lib/query-keys';
import { fetchFromStorage } from 'lib/storage';
import { useLastSeenPromotionName } from 'lib/store/zustand/ui.store';
import { useWalletNetworks } from 'lib/store/zustand/wallet.store';

export const useAdvertisingPromotionQuery = () => {
  const networks = useWalletNetworks();
  // Read active network_id from the TanStack Query cache — the same key that
  // usePassiveStorage('network_id') in ready.ts populates and keeps up to date
  // via browser.storage.onChanged → queryClient.setQueryData.
  const { data: networkId } = useQuery({
    queryKey: storageKeys.one('network_id'),
    queryFn: () => fetchFromStorage<string>('network_id'),
    staleTime: Infinity
  });
  // Resolve the active network; undefined while networkId is not yet loaded → enabled stays false
  const network = networkId ? networks.find(n => n.id === networkId) : undefined;
  return useQuery({
    queryKey: miscKeys.advertisingPromo,
    queryFn: fetchAdvertisingInfo,
    enabled: network?.type === 'main',
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false
  });
};

export const useActivePromotion = (): AdvertisingPromotion | undefined => {
  const { data } = useAdvertisingPromotionQuery();
  return data ?? undefined;
};

export const useIsNewPromotionAvailable = (): boolean => {
  const activePromotion = useActivePromotion();
  const lastSeenName = useLastSeenPromotionName();
  return lastSeenName !== activePromotion?.name;
};
