import { isEqual } from 'lodash';

import { useAccountCollectibles } from 'lib/assets/hooks';
import { useCollectiblesDetailsQuery } from 'lib/collectibles/use-collectibles-details.query';
import { useAccount, useChainId } from 'lib/temple/front';
import { useMemoWithCompare } from 'lib/ui/hooks';

export const useCollectiblesDetailsLoading = () => {
  const chainId = useChainId()!;
  const { publicKeyHash } = useAccount();
  const collectibles = useAccountCollectibles(publicKeyHash, chainId);

  const slugs = useMemoWithCompare(() => collectibles.map(({ slug }) => slug).sort(), [collectibles], isEqual);

  // TanStack Query handles fetching + refetch interval automatically
  useCollectiblesDetailsQuery(slugs);
};
