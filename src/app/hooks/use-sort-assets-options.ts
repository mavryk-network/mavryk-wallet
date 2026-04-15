import { Dispatch, SetStateAction, useMemo } from 'react';

import { SortListItemType } from 'app/templates/SortPopup';
import { SortOptions } from 'lib/assets/use-sorted';

/**
 * Returns a memoized array of standard sort options (High to Low, Low to High, By Name)
 * for use in asset listing tabs. Eliminates the identical 3-item sort array
 * duplicated across CollectiblesTab, RWATab, and TokensTab.
 */
export const useSortAssetsOptions = (
  sortOption: SortOptions | null,
  setSortOption: Dispatch<SetStateAction<SortOptions | null>>
): SortListItemType[] =>
  useMemo(
    () => [
      {
        id: SortOptions.HIGH_TO_LOW,
        selected: sortOption === SortOptions.HIGH_TO_LOW,
        onClick: () => {
          setSortOption(SortOptions.HIGH_TO_LOW);
        },
        nameI18nKey: 'highToLow'
      },
      {
        id: SortOptions.LOW_TO_HIGH,
        selected: sortOption === SortOptions.LOW_TO_HIGH,
        onClick: () => setSortOption(SortOptions.LOW_TO_HIGH),
        nameI18nKey: 'lowToHigh'
      },
      {
        id: SortOptions.BY_NAME,
        selected: sortOption === SortOptions.BY_NAME,
        onClick: () => setSortOption(SortOptions.BY_NAME),
        nameI18nKey: 'byName'
      }
    ],
    [sortOption, setSortOption]
  );
