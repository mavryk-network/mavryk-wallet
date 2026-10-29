import { useMemo } from 'react';

import { useMetadataFetching } from 'lib/metadata/use-metadata-query';
import { useOwnedMetadata } from 'lib/metadata/use-owned-metadata';

export const useCollectibleMetadataSelector = (slug: string) => useOwnedMetadata('collectibles')[slug];

export const useAllCollectiblesMetadataSelector = () => {
  const records = useOwnedMetadata('collectibles');
  return useMemo(() => new Map(Object.entries(records)), [records]);
};

export const useCollectiblesMetadataLoadingSelector = () => useMetadataFetching('collectibles');
