import { useCollectiblesMetadataLoadingSelector } from 'app/store/collectibles-metadata/selectors';
import { useCollectiblesMetadataPresenceCheck, useGetCollectibleMetadata } from 'lib/metadata';

import { useAssetListingLogic, useInitialPageAmount, useMetaSlugsToCheck } from './use-asset-listing-logic';
import { useCollectiblesPaginationLogic } from './use-collectibles-pagination-logic';

export { ITEMS_PER_PAGE } from './use-asset-listing-logic';

export const useCollectiblesListingLogic = (allSlugsSorted: string[]) => {
  const initialAmount = useInitialPageAmount();

  const {
    slugs: paginatedSlugs,
    isLoading: pageIsLoading,
    loadNext
  } = useCollectiblesPaginationLogic(allSlugsSorted, initialAmount);

  const metadatasLoading = useCollectiblesMetadataLoadingSelector();
  const getCollectibleMeta = useGetCollectibleMetadata();

  const result = useAssetListingLogic(allSlugsSorted, {
    assetsLoadingType: 'collectibles',
    metadatasLoading,
    paginatedSlugs,
    pageIsLoading,
    loadNext,
    getMetadata: getCollectibleMeta
  });

  const metaToCheckAndLoad = useMetaSlugsToCheck(
    allSlugsSorted,
    paginatedSlugs.length,
    pageIsLoading,
    result.isInSearchMode
  );

  useCollectiblesMetadataPresenceCheck(metaToCheckAndLoad);

  return result;
};
