import { useRwasMetadataLoadingSelector } from 'app/store/rwas-metadata/selectors';
import { useRwasMetadataPresenceCheck, useGetRwaMetadata } from 'lib/metadata';

import { useAssetListingLogic, useInitialPageAmount, useMetaSlugsToCheck } from './use-asset-listing-logic';
import { useRwasPaginationLogic } from './use-rwas-pagination-logic';

export { ITEMS_PER_PAGE } from './use-asset-listing-logic';

export const useRWAListingLogic = (allSlugsSorted: string[]) => {
  const initialAmount = useInitialPageAmount();

  const {
    slugs: paginatedSlugs,
    isLoading: pageIsLoading,
    loadNext
  } = useRwasPaginationLogic(allSlugsSorted, initialAmount);

  const metadatasLoading = useRwasMetadataLoadingSelector();
  const getRwaMeta = useGetRwaMetadata();

  const result = useAssetListingLogic(allSlugsSorted, {
    assetsLoadingType: 'rwas',
    metadatasLoading,
    paginatedSlugs,
    pageIsLoading,
    loadNext,
    getMetadata: getRwaMeta
  });

  const metaToCheckAndLoad = useMetaSlugsToCheck(
    allSlugsSorted,
    paginatedSlugs.length,
    pageIsLoading,
    result.isInSearchMode
  );

  useRwasMetadataPresenceCheck(metaToCheckAndLoad);

  return result;
};
