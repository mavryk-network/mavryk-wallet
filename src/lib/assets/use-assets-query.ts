import { useIsFetching, useQuery } from '@tanstack/react-query';

import type { AssetsType } from 'app/store/assets/selectors';
import { isKnownChainId } from 'lib/apis/tzkt';
import { useDetailScope } from 'lib/asset-details/use-detail-scope';
import { ASSETS_SYNC_INTERVAL } from 'lib/fixed-times';
import { useMetadataScope } from 'lib/metadata/use-metadata-scope';
import { assetsKeys } from 'lib/query-keys';
import { useOwnedUIStatus } from 'lib/store/zustand/ui-client';

import { loadAccountAssets } from './load-account-assets';

/** Readiness is independent of request loading; Query deduplicates mounted drivers. */
export function useAssetsQuery(category: AssetsType) {
  const scope = useMetadataScope();
  const { isReady } = useOwnedUIStatus();
  useQuery({
    queryKey: assetsKeys.account(category, scope.account, scope.chainId, scope.networkId),
    enabled: isReady && !!scope.account && !!scope.networkId && isKnownChainId(scope.chainId),
    queryFn: ({ signal }) => loadAccountAssets(scope, category, signal),
    staleTime: ASSETS_SYNC_INTERVAL,
    cacheTime: 5 * 60_000,
    refetchInterval: ASSETS_SYNC_INTERVAL,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });
}

/** Loading follows the selected request scope, never a durable asset flag. */
export function useAssetsFetching(category: AssetsType) {
  const scope = useDetailScope();
  return useIsFetching(assetsKeys.account(category, scope.account, scope.chainId, scope.networkId)) > 0;
}
