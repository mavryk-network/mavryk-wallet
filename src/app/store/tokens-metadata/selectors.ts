import { useMetadataFetching } from 'lib/metadata/use-metadata-query';
import { useOwnedMetadata } from 'lib/metadata/use-owned-metadata';

export const useTokenMetadataSelector = (slug: string) => useOwnedMetadata('tokens')[slug];

export const useAllTokensMetadataSelector = () => {
  const records = useOwnedMetadata('tokens');
  return records;
};

export const useTokensMetadataLoadingSelector = () => useMetadataFetching('tokens');
