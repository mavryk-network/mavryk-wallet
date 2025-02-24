import React, { memo, useEffect, useMemo, useState } from 'react';

import clsx from 'clsx';

import { SyncSpinner } from 'app/atoms';
import { ScrollBackUpButton } from 'app/atoms/ScrollBackUpButton';
import { SimpleInfiniteScroll } from 'app/atoms/SimpleInfiniteScroll';
import { useAppEnv } from 'app/env';
import { useRWAListingLogic } from 'app/hooks/use-rwa-listing-logic';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { AssetsSelectors } from 'app/pages/Home/OtherComponents/Assets.selectors';
import { ManageAssetsButton } from 'app/pages/ManageAssets/ManageAssetsButton';
import {
  SearchExplorer,
  SearchExplorerClosed,
  SearchExplorerFinder,
  SearchExplorerIconBtn,
  SearchExplorerOpened,
  SearchExplorerCloseBtn
} from 'app/templates/SearchExplorer';
import { SortButton, SortListItemType, SortPopup, SortPopupContent } from 'app/templates/SortPopup';
// import { useEnabledAccountRwaSlugs } from 'lib/assets/hooks/rwas';
import { useEnabledAccountRwaSlugs } from 'lib/assets/hooks/rwas';
import { AssetTypesEnum } from 'lib/assets/types';
import { SortOptions } from 'lib/assets/use-sorted';
import { T } from 'lib/i18n';
import { useAccount, useChainId } from 'lib/temple/front';

import { useSortededRwasSlugs } from '../hooks/use-rwa-sorted.hook';

import { mockedRWASlug } from './rwa.mock';
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

  const [sortOption, setSortOption] = useState<null | SortOptions>(SortOptions.HIGH_TO_LOW);

  const memoizedSortAssetsOptions: SortListItemType[] = useMemo(
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
    [sortOption]
  );

  const sortedAssets = useSortededRwasSlugs(sortOption, allSlugs) ?? [mockedRWASlug];

  const { displayedSlugs, isSyncing, isInSearchMode, paginatedSlugs, loadNext, searchValue, setSearchValue } =
    useRWAListingLogic(sortedAssets);

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
      <div className={clsx('my-3', popup && 'mx-4')}>
        <SearchExplorer>
          <>
            <SearchExplorerOpened>
              <div className={clsx('w-full flex justify-end', popup && 'pr-12px pl-4', styles.searchWrapper)}>
                <SearchExplorerFinder
                  value={searchValue}
                  onValueChange={setSearchValue}
                  containerClassName="mr-2"
                  testID={AssetsSelectors.searchAssetsInputTokens}
                />
                <SearchExplorerCloseBtn />
              </div>
            </SearchExplorerOpened>
            <SearchExplorerClosed>
              <div className={clsx('flex justify-end items-center pl-4', popup && 'pr-12px', styles.searchWrapper)}>
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
          buildEmptySection(isSyncing)
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

const buttonStyle = { maxHeight: 27, display: 'flex', alignItems: 'center' };

const buildEmptySection = (isSyncing: boolean) =>
  isSyncing ? (
    <SyncSpinner className="pt-4" />
  ) : (
    <div className="w-full py-23 flex flex-col items-center gap-y-4">
      <p className={'text-white text-base-plus text-center'}>
        <T id="noRWAs" />
      </p>
      <ButtonRounded type="button" size="small" fill style={buttonStyle}>
        <T id="getAssets" />
      </ButtonRounded>
    </div>
  );
