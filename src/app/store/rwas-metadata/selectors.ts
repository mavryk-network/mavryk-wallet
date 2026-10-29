import { useMemo } from 'react';

import { useMetadataFetching } from 'lib/metadata/use-metadata-query';
import { useOwnedMetadata } from 'lib/metadata/use-owned-metadata';

export const useRwaMetadataSelector = (slug: string) => useOwnedMetadata('rwas')[slug];

export const useAllRwasMetadataSelector = () => {
  const records = useOwnedMetadata('rwas');
  return useMemo(() => new Map(Object.entries(records)), [records]);
};

export const useRwasMetadataLoadingSelector = () => useMetadataFetching('rwas');
