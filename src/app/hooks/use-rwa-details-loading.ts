import { useDetailScope } from 'lib/asset-details/use-detail-scope';
import { useAccountRwas } from 'lib/assets/hooks/rwas';
import { rwaDetailHooks } from 'lib/rwas/use-rwas-details.query';

/** Register the current account's asset set with its shared detail batch. */
export const useRwasDetailsBatch = () => {
  const scope = useDetailScope();
  const assets = useAccountRwas(scope.account, scope.chainId);
  rwaDetailHooks.useBatch(
    scope,
    assets.map(({ slug }) => slug)
  );
};
