import { useDetailScope } from 'lib/asset-details/use-detail-scope';
import { useAccountCollectibles } from 'lib/assets/hooks/collectibles';
import { collectibleDetailHooks } from 'lib/collectibles/use-collectibles-details.query';

/** Register the current account's asset set with its shared detail batch. */
export const useCollectiblesDetailsBatch = () => {
  const scope = useDetailScope();
  const assets = useAccountCollectibles(scope.account, scope.chainId);
  collectibleDetailHooks.useBatch(
    scope,
    assets.map(({ slug }) => slug)
  );
};
