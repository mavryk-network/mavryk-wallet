import { useMemo, useState } from 'react';

import { useDebounce } from 'use-debounce';

import { useAreAssetsLoading } from 'app/store/assets/selectors';
import { useRwasMetadataLoadingSelector } from 'app/store/rwas-metadata/selectors';
import { searchAssetsWithNoMeta } from 'lib/assets/search.utils';
import { useRwasMetadataPresenceCheck, useGetRwaMetadata } from 'lib/metadata';
import { isSearchStringApplicable } from 'lib/utils/search-items';
import { createLocationState } from 'lib/woozie/location';

import { ITEMS_PER_PAGE, useRwasPaginationLogic } from './use-rwas-pagination-logic';

export const useRWAListingLogic = (allSlugsSorted: string[]) => {
  const initialAmount = useMemo(() => {
    const { search } = createLocationState();
    const usp = new URLSearchParams(search);
    const amount = usp.get('amount');
    return amount ? Number(amount) : 0;
  }, []);

  const {
    slugs: paginatedSlugs,
    isLoading: pageIsLoading,
    loadNext
  } = useRwasPaginationLogic(allSlugsSorted, initialAmount);

  const assetsAreLoading = useAreAssetsLoading('rwas');
  const metadatasLoading = useRwasMetadataLoadingSelector();

  const [searchValue, setSearchValue] = useState('');
  const [searchValueDebounced] = useDebounce(searchValue, 500);

  const isInSearchMode = isSearchStringApplicable(searchValueDebounced);

  const isSyncing = isInSearchMode ? assetsAreLoading || metadatasLoading : assetsAreLoading || pageIsLoading;

  // In `isInSearchMode === false` there might be a glitch after `assetsAreLoading` & before `pageIsLoading`
  // of `isSyncing === false`. Debouncing to preserve `true` for a while.
  const [isSyncingDebounced] = useDebounce(isSyncing, 500);

  const metaToCheckAndLoad = useMemo(() => {
    // Search is not paginated. This is how all needed meta is loaded
    if (isInSearchMode) return allSlugsSorted;

    // In pagination, loading meta for the following pages in advance,
    // while not required in current page
    return pageIsLoading ? undefined : allSlugsSorted.slice(paginatedSlugs.length + ITEMS_PER_PAGE * 2);
  }, [isInSearchMode, pageIsLoading, allSlugsSorted, paginatedSlugs.length]);

  useRwasMetadataPresenceCheck(metaToCheckAndLoad);

  const getRwaMeta = useGetRwaMetadata();

  const displayedSlugs = useMemo(
    () =>
      isInSearchMode
        ? searchAssetsWithNoMeta(searchValueDebounced, allSlugsSorted, getRwaMeta, slug => slug)
        : paginatedSlugs,
    [isInSearchMode, paginatedSlugs, searchValueDebounced, allSlugsSorted, getRwaMeta]
  );

  return {
    isInSearchMode,
    displayedSlugs,
    paginatedSlugs,
    isSyncing: isSyncing || isSyncingDebounced,
    loadNext,
    searchValue,
    setSearchValue
  };
};
