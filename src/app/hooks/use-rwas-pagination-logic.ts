import { useCallback } from 'react';

import { FetchedMetadataRecord } from 'lib/metadata/fetch';
import { metadataStore, useAllRwasMetadataSelector } from 'lib/store/zustand/metadata.store';

import { useAssetPaginationLogic } from './use-asset-pagination-logic';

export { ITEMS_PER_PAGE } from './use-asset-pagination-logic';

export const useRwasPaginationLogic = (allSlugsSorted: string[], initialSize: number) => {
  const allMeta = useAllRwasMetadataSelector();
  const putMetadata = useCallback(
    (records: FetchedMetadataRecord) => metadataStore.getState().putRwasMetadata(records),
    []
  );

  return useAssetPaginationLogic(allSlugsSorted, initialSize, allMeta, putMetadata);
};
