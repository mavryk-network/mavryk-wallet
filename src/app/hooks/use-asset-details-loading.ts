import { isEqual } from 'lodash';

import { useAccount, useChainId } from 'lib/temple/front';
import { useMemoWithCompare } from 'lib/ui/hooks';

type AccountAsset = { slug: string };

export const useAssetDetailsLoading = (
  useAccountAssets: (pkh: string, chainId: string) => AccountAsset[],
  useDetailsQuery: (slugs: string[]) => void
) => {
  const chainId = useChainId()!;
  const { publicKeyHash } = useAccount();
  const assets = useAccountAssets(publicKeyHash, chainId);

  const slugs = useMemoWithCompare(() => assets.map(({ slug }) => slug).sort(), [assets], isEqual);

  // TanStack Query handles fetching + refetch interval automatically
  useDetailsQuery(slugs);
};
