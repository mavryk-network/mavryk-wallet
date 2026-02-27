import { useAccountCollectibles } from 'lib/assets/hooks';
import { useCollectiblesDetailsQuery } from 'lib/collectibles/use-collectibles-details.query';

import { useAssetDetailsLoading } from './use-asset-details-loading';

export const useCollectiblesDetailsLoading = () => {
  useAssetDetailsLoading(useAccountCollectibles, useCollectiblesDetailsQuery);
};
