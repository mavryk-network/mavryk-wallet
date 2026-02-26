import { useMemo, useState } from 'react';

import { useDebounce } from 'use-debounce';

import { AssetsType, useAreAssetsLoading } from 'lib/store/zustand/assets.store';
import { searchAssetsWithNoMeta } from 'lib/assets/search.utils';
import { TokenMetadataGetter } from 'lib/metadata';
import { isSearchStringApplicable } from 'lib/utils/search-items';
import { createLocationState } from 'lib/woozie/location';

export const ITEMS_PER_PAGE = 30;

interface AssetListingDeps {
  /** Which asset group loading state to check */
  assetsLoadingType: AssetsType;
  /** Whether metadata is currently loading */
  metadatasLoading: boolean;
  /** Paginated slugs from the type-specific pagination hook */
  paginatedSlugs: string[];
  /** Whether the current page is loading */
  pageIsLoading: boolean;
  /** Load next page callback from the pagination hook */
  loadNext: () => void;
  /** Function to get metadata for a slug (from type-specific metadata hook) */
  getMetadata: TokenMetadataGetter;
}

/**
 * Computes which slugs need metadata presence checking.
 * Call this from the type-specific wrapper, then pass the result
 * to the type-specific `useMetadataPresenceCheck` hook.
 */
export const useMetaSlugsToCheck = (
  allSlugsSorted: string[],
  paginatedSlugsLength: number,
  pageIsLoading: boolean,
  isInSearchMode: boolean
) =>
  useMemo(() => {
    // Search is not paginated. This is how all needed meta is loaded
    if (isInSearchMode) return allSlugsSorted;

    // In pagination, loading meta for the following pages in advance,
    // while not required in current page
    return pageIsLoading ? undefined : allSlugsSorted.slice(paginatedSlugsLength + ITEMS_PER_PAGE * 2);
  }, [isInSearchMode, pageIsLoading, allSlugsSorted, paginatedSlugsLength]);

/**
 * Computes the initial page size from URL params (shared between collectibles and RWAs).
 */
export const useInitialPageAmount = () =>
  useMemo(() => {
    const { search } = createLocationState();
    const usp = new URLSearchParams(search);
    const amount = usp.get('amount');
    return amount ? Number(amount) : 0;
  }, []);

/**
 * Shared listing logic for collectible and RWA asset tabs.
 * Replaces the duplicate `useCollectiblesListingLogic` and `useRWAListingLogic`.
 *
 * The caller is responsible for calling their type-specific React hooks
 * (pagination, metadata selectors, metadata presence check) and passing
 * the plain results here via `deps`.
 */
export const useAssetListingLogic = (allSlugsSorted: string[], deps: AssetListingDeps) => {
  const { assetsLoadingType, metadatasLoading, paginatedSlugs, pageIsLoading, loadNext, getMetadata } = deps;

  const assetsAreLoading = useAreAssetsLoading(assetsLoadingType);

  const [searchValue, setSearchValue] = useState('');
  const [searchValueDebounced] = useDebounce(searchValue, 500);

  const isInSearchMode = isSearchStringApplicable(searchValueDebounced);

  const isSyncing = isInSearchMode ? assetsAreLoading || metadatasLoading : assetsAreLoading || pageIsLoading;

  // In `isInSearchMode === false` there might be a glitch after `assetsAreLoading` & before `pageIsLoading`
  // of `isSyncing === false`. Debouncing to preserve `true` for a while.
  const [isSyncingDebounced] = useDebounce(isSyncing, 500);

  const displayedSlugs = useMemo(
    () =>
      isInSearchMode
        ? searchAssetsWithNoMeta(searchValueDebounced, allSlugsSorted, getMetadata, slug => slug)
        : paginatedSlugs,
    [isInSearchMode, paginatedSlugs, searchValueDebounced, allSlugsSorted, getMetadata]
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
