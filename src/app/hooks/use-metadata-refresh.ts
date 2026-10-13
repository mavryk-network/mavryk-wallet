import { useQuery, useQueryClient } from '@tanstack/react-query';

import { refreshMetadata } from 'lib/metadata/refresh-metadata';
import { useMetadataScope } from 'lib/metadata/use-metadata-scope';
import { metadataKeys } from 'lib/query-keys';
import { useOwnedUIStatus } from 'lib/store/zustand/ui-client';
import { TempleChainId } from 'lib/temple/types';

/** Versioned media refresh retains its mainnet gate and exposes failures through Query. */
export const useMetadataRefresh = () => {
  const client = useQueryClient();
  const scope = useMetadataScope();
  const { isReady } = useOwnedUIStatus();
  useQuery({
    queryKey: [...metadataKeys.scope('tokens', scope), 'versioned-refresh'],
    enabled: isReady && !!scope.account && !!scope.networkId && scope.chainId === TempleChainId.Mainnet,
    queryFn: ({ signal }) => refreshMetadata(client, scope, signal).then(() => true),
    staleTime: Infinity,
    cacheTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
};
