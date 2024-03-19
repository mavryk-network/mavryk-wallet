import React, { memo, useEffect, useMemo, useState } from 'react';

import clsx from 'clsx';
import { isEqual } from 'lodash';

import { SyncSpinner } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { AssetsSelectors } from 'app/pages/Home/OtherComponents/Assets.selectors';
import { ManageAssetsButton } from 'app/pages/ManageAssets/ManageAssetsButton';
import { useTokensMetadataLoadingSelector } from 'app/store/tokens-metadata/selectors';
import {
  SearchExplorer,
  SearchExplorerClosed,
  SearchExplorerFinder,
  SearchExplorerIconBtn,
  SearchExplorerOpened
} from 'app/templates/SearchExplorer';
import { SortButton, SortListItemType, SortPopup, SortPopupContent } from 'app/templates/SortPopup';
import { AssetTypesEnum } from 'lib/assets/types';
import { useFilteredAssetsSlugs } from 'lib/assets/use-filtered';
import { SortOptions } from 'lib/assets/use-sorted';
import { T } from 'lib/i18n';
import { useAccount, useChainId, useNFTTokens } from 'lib/temple/front';
import { useSyncTokens } from 'lib/temple/front/sync-tokens';
import { useMemoWithCompare } from 'lib/ui/hooks';

import { useSortededNFTsSlugs } from '../hooks/use-nfts-sorted.hook';
import { NFTItem } from './NFTItem';
import styles from './NFTs.module.css';

interface Props {
  scrollToTheTabsBar: EmptyFn;
}

// show NFts details from metadata
const areDetailsShown = true;

export const NFTsTab = memo<Props>(({ scrollToTheTabsBar }) => {
  const chainId = useChainId(true)!;
  const { popup } = useAppEnv();
  const { publicKeyHash } = useAccount();
  const { isSyncing: tokensAreSyncing } = useSyncTokens();
  const metadatasLoading = useTokensMetadataLoadingSelector();

  const [sortOption, setSortOption] = useState<null | SortOptions>(SortOptions.HIGH_TO_LOW);

  const { data: nfts = [], isValidating: readingNFTs } = useNFTTokens(chainId, publicKeyHash, true);

  const nftsSlugs = useMemoWithCompare(() => nfts.map(nft => nft.tokenSlug).sort(), [nfts], isEqual);

  const { filteredAssets, searchValue, setSearchValue } = useFilteredAssetsSlugs(nftsSlugs, false);

  const shouldScrollToTheTabsBar = nfts.length > 0;
  useEffect(() => void scrollToTheTabsBar(), [shouldScrollToTheTabsBar, scrollToTheTabsBar]);

  const isSyncing = tokensAreSyncing || metadatasLoading || readingNFTs;

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

  const sortedAssets = useSortededNFTsSlugs(sortOption, filteredAssets);

  return (
    <div className="w-full max-w-sm mx-auto relative">
      <div className={clsx('my-3', popup && 'mx-4')}>
        <SearchExplorer>
          <>
            <SearchExplorerOpened>
              <div className={clsx('w-full flex justify-end', styles.searchWrapper)}>
                <SearchExplorerFinder
                  value={searchValue}
                  onValueChange={setSearchValue}
                  containerClassName="mr-2"
                  testID={AssetsSelectors.searchAssetsInputTokens}
                />
              </div>
            </SearchExplorerOpened>
            <SearchExplorerClosed>
              <div className={clsx('flex justify-end items-center', styles.searchWrapper)}>
                <SearchExplorerIconBtn />

                <SortPopup>
                  <SortButton />
                  <SortPopupContent items={memoizedSortAssetsOptions} />
                </SortPopup>

                <ManageAssetsButton assetSlug={AssetTypesEnum.NFTs} />
              </div>
            </SearchExplorerClosed>
          </>
        </SearchExplorer>

        {sortedAssets.length === 0 ? (
          buildEmptySection(isSyncing)
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {sortedAssets.map(slug => (
                <NFTItem key={slug} assetSlug={slug} accountPkh={publicKeyHash} areDetailsShown={areDetailsShown} />
              ))}
            </div>

            {isSyncing && <SyncSpinner className="mt-6" />}
          </>
        )}
      </div>
    </div>
  );
});

const buildEmptySection = (isSyncing: boolean) =>
  isSyncing ? (
    <SyncSpinner className="mt-23" />
  ) : (
    <div className="w-full py-23 flex flex-col items-center gap-y-4">
      <p className={'text-white text-base-plus text-center'}>
        <T id="zeroNFTText" />
      </p>
      <ButtonRounded type="button" size="small" fill>
        <T id="getNFTs" />
      </ButtonRounded>
    </div>
  );
