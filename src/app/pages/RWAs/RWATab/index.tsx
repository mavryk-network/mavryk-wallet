import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

import clsx from 'clsx';

import { SyncSpinner } from 'app/atoms';
import { ScrollBackUpButton } from 'app/atoms/ScrollBackUpButton';
import { SimpleInfiniteScroll } from 'app/atoms/SimpleInfiniteScroll';
import { useAppEnv } from 'app/env';
import { useRWAListingLogic } from 'app/hooks/use-rwa-listing-logic';
import { useSortAssetsOptions } from 'app/hooks/use-sort-assets-options';
import { useSortedAssetSlugs } from 'app/hooks/use-sorted-asset-slugs';
import { AssetsSelectors } from 'app/pages/Home/OtherComponents/Assets.selectors';
import { ManageAssetsButton } from 'app/pages/ManageAssets/ManageAssetsButton';
import { useAllRwasDetails } from 'lib/rwas/use-rwas-details.query';
import { AssetListEmptySection } from 'app/templates/AssetListEmptySection';
import {
  SearchExplorer,
  SearchExplorerClosed,
  SearchExplorerFinder,
  SearchExplorerIconBtn,
  SearchExplorerOpened,
  SearchExplorerCloseBtn
} from 'app/templates/SearchExplorer';
import { SortButton, SortPopup, SortPopupContent } from 'app/templates/SortPopup';
import { useEnabledAccountRwaSlugs } from 'lib/assets/hooks/rwas';
import { AssetTypesEnum } from 'lib/assets/types';
import { SortOptions } from 'lib/assets/use-sorted';
import { useAccount, useChainId } from 'lib/temple/front';

import styles from './rwa.module.css';
import { RwaItem } from './RwaItem';

interface Props {
  scrollToTheTabsBar: EmptyFn;
}

// show NFts details from metadata
const areDetailsShown = true;

export const RWATab = memo<Props>(({ scrollToTheTabsBar }) => {
  const chainId = useChainId(true)!;
  const { popup } = useAppEnv();
  const { publicKeyHash } = useAccount();
  const allSlugs = useEnabledAccountRwaSlugs();
  const assetsDetails = useAllRwasDetails();

  const [sortOption, setSortOption] = useState<null | SortOptions>(SortOptions.HIGH_TO_LOW);

  const memoizedSortAssetsOptions = useSortAssetsOptions(sortOption, setSortOption);

  const sortedAssets = useSortedAssetSlugs(sortOption, allSlugs, assetsDetails) ?? [];

  const { displayedSlugs, isSyncing, isInSearchMode, paginatedSlugs, loadNext, searchValue, setSearchValue } =
    useRWAListingLogic(sortedAssets);

  const clearInput = useCallback(() => {
    setSearchValue('');
  }, []);

  const shouldScrollToTheTabsBar = paginatedSlugs.length > 0;

  useEffect(() => {
    if (shouldScrollToTheTabsBar) void scrollToTheTabsBar();
  }, [shouldScrollToTheTabsBar, scrollToTheTabsBar]);

  const contentElement = useMemo(
    () => (
      <div className={clsx('flex flex-col w-full')}>
        {displayedSlugs.map(slug => (
          <RwaItem
            key={slug}
            assetSlug={slug}
            chainId={chainId}
            accountPkh={publicKeyHash}
            areDetailsShown={areDetailsShown}
          />
        ))}
      </div>
    ),
    [displayedSlugs, publicKeyHash, chainId]
  );

  return (
    <div className={clsx('w-full mx-auto relative', popup ? 'max-w-sm ' : 'max-w-screen-xxs')}>
      <div className={clsx('my-3 w-full', popup && 'mx-4')}>
        <SearchExplorer>
          <>
            <SearchExplorerOpened>
              <div className={clsx('w-full flex justify-end', popup && 'px-4', styles.searchWrapper)}>
                <SearchExplorerFinder
                  value={searchValue}
                  onValueChange={setSearchValue}
                  containerClassName="mr-2"
                  testID={AssetsSelectors.searchAssetsInputTokens}
                />
                <SearchExplorerCloseBtn onClick={clearInput} />
              </div>
            </SearchExplorerOpened>
            <SearchExplorerClosed>
              <div
                className={clsx(
                  'flex justify-end items-center pl-4',
                  popup && 'pr-12px',
                  styles.searchWrapper,
                  styles.closed
                )}
              >
                <SearchExplorerIconBtn />

                <SortPopup>
                  <SortButton />
                  <SortPopupContent items={memoizedSortAssetsOptions} alternativeLogic={!popup} />
                </SortPopup>

                <ManageAssetsButton assetSlug={AssetTypesEnum.Rwas} />
              </div>
            </SearchExplorerClosed>
          </>
        </SearchExplorer>

        {displayedSlugs.length === 0 ? (
          <AssetListEmptySection isSyncing={isSyncing} messageI18nKey="noRWAs" buttonI18nKey="getAssets" />
        ) : (
          <>
            {isInSearchMode ? (
              contentElement
            ) : (
              <SimpleInfiniteScroll loadNext={loadNext}>{contentElement}</SimpleInfiniteScroll>
            )}

            <ScrollBackUpButton />

            {isSyncing && <SyncSpinner className="mt-6" />}
          </>
        )}
      </div>
    </div>
  );
});
