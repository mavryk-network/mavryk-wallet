import { useAccountRwas } from 'lib/assets/hooks/rwas';
import { useRwasDetailsQuery } from 'lib/rwas/use-rwas-details.query';

import { useAssetDetailsLoading } from './use-asset-details-loading';

export const useRWAsDetailsLoading = () => {
  useAssetDetailsLoading(useAccountRwas, useRwasDetailsQuery);
};
