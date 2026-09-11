import { useMemo } from 'react';

import { useOwnedUI } from 'lib/store/zustand/ui-client';

import { useSelector } from '../root-state.selector';

export const useAllRwasMetadataSelector = () => {
  const records = useOwnedUI(state => state.metadata.rwasMetadata);
  return useMemo(() => new Map(Object.entries(records)), [records]);
};

export const useRwaMetadataSelector = (slug: string) => useOwnedUI(state => state.metadata.rwasMetadata[slug]);

export const useRwasMetadataLoadingSelector = () => useSelector(({ rwasMetadata }) => rwasMetadata.isLoading);
