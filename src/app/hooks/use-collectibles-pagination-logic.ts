import { useCallback } from 'react';

import { FetchedMetadataRecord } from 'lib/metadata/fetch';
import { metadataStore, useAllCollectiblesMetadataSelector } from 'lib/store/zustand/metadata.store';

import { useAssetPaginationLogic } from './use-asset-pagination-logic';

export { ITEMS_PER_PAGE } from './use-asset-pagination-logic';

export const useCollectiblesPaginationLogic = (allSlugsSorted: string[], initialSize: number) => {
  const allMeta = useAllCollectiblesMetadataSelector();
  const putMetadata = useCallback(
    (records: FetchedMetadataRecord) => metadataStore.getState().putCollectiblesMetadata(records),
    []
  );

  return useAssetPaginationLogic(allSlugsSorted, initialSize, allMeta, putMetadata);
};
