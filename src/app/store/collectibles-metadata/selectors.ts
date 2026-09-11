import { useMemo } from 'react';

import { useOwnedUI } from 'lib/store/zustand/ui-client';

import { useSelector } from '../root-state.selector';

export const useAllCollectiblesMetadataSelector = () => {
  const records = useOwnedUI(state => state.metadata.collectiblesMetadata);
  return useMemo(() => new Map(Object.entries(records)), [records]);
};

export const useCollectibleMetadataSelector = (slug: string) =>
  useOwnedUI(state => state.metadata.collectiblesMetadata[slug]);

export const useCollectiblesMetadataLoadingSelector = () =>
  useSelector(({ collectiblesMetadata }) => collectiblesMetadata.isLoading);
