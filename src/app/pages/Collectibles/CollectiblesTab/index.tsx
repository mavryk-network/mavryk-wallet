import React, { memo, useCallback, useMemo, useState } from 'react';

import clsx from 'clsx';

import { SyncSpinner } from 'app/atoms';
import { ScrollBackUpButton } from 'app/atoms/ScrollBackUpButton';
import { SimpleInfiniteScroll } from 'app/atoms/SimpleInfiniteScroll';
import { useAppEnv } from 'app/env';
import { useCollectiblesListingLogic } from 'app/hooks/use-collectibles-listing-logic';
import { useSortAssetsOptions } from 'app/hooks/use-sort-assets-options';
import { useSortedAssetSlugs } from 'app/hooks/use-sorted-asset-slugs';
import { AssetsSelectors } from 'app/pages/Home/OtherComponents/Assets.selectors';
import { ManageAssetsButton } from 'app/pages/ManageAssets/ManageAssetsButton';
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
import { useEnabledAccountCollectiblesSlugs } from 'lib/assets/hooks';
import { AssetTypesEnum } from 'lib/assets/types';
import { SortOptions } from 'lib/assets/use-sorted';
import { useAllCollectiblesDetails } from 'lib/collectibles/use-collectibles-details.query';
import { useAccount, useChainId } from 'lib/temple/front';

import styles from './Collectible.module.css';
import { CollectibleItem } from './CollectibleItem';

// show NFts details from metadata
const areDetailsShown = true;

export const CollectiblesTab = memo(() => {
  const chainId = useChainId(true)!;
  const { popup } = useAppEnv();
  const { publicKeyHash } = useAccount();
  const allSlugs = useEnabledAccountCollectiblesSlugs();
  const assetsDetails = useAllCollectiblesDetails();

  const [sortOption, setSortOption] = useState<null | SortOptions>(SortOptions.HIGH_TO_LOW);

  const memoizedSortAssetsOptions = useSortAssetsOptions(sortOption, setSortOption);

  const sortedAssets = useSortedAssetSlugs(sortOption, allSlugs, assetsDetails);

  const { displayedSlugs, isSyncing, isInSearchMode, loadNext, searchValue, setSearchValue } =
    useCollectiblesListingLogic(sortedAssets);

  const clearInput = useCallback(() => {
    setSearchValue('');
  }, []);

  const contentElement = useMemo(
    () => (
      <div className={clsx('grid gap-4', popup ? 'grid-cols-2' : 'grid-cols-3')}>
        {displayedSlugs.map(slug => (
          <CollectibleItem
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
      <div className={clsx('my-3 w-full flex justify-end')}>
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

                <ManageAssetsButton assetSlug={AssetTypesEnum.Collectibles} />
              </div>
            </SearchExplorerClosed>
          </>
        </SearchExplorer>

        {displayedSlugs.length === 0 ? (
          <AssetListEmptySection isSyncing={isSyncing} messageI18nKey="zeroNFTText" buttonI18nKey="getNFTs" />
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
