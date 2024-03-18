import React, { FC, memo, useCallback, useEffect, useMemo, useState } from 'react';

import clsx from 'clsx';
import { isEqual } from 'lodash';

import { SyncSpinner } from 'app/atoms';
import Checkbox from 'app/atoms/Checkbox';
import Divider from 'app/atoms/Divider';
import DropdownWrapper from 'app/atoms/DropdownWrapper';
import { useAppEnv } from 'app/env';
import { ReactComponent as EditingIcon } from 'app/icons/editing.svg';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { AssetsSelectors } from 'app/pages/Home/OtherComponents/Assets.selectors';
import { ManageAssetsButton } from 'app/pages/ManageAssets/ManageAssetsButton';
import { useTokensMetadataLoadingSelector } from 'app/store/tokens-metadata/selectors';
import { ButtonForManageDropdown } from 'app/templates/ManageDropdown';
import SearchAssetField from 'app/templates/SearchAssetField';
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
import { T, t } from 'lib/i18n';
import { useAccount, useChainId, useCollectibleTokens } from 'lib/temple/front';
import { useSyncTokens } from 'lib/temple/front/sync-tokens';
import { useMemoWithCompare } from 'lib/ui/hooks';
import { useLocalStorage } from 'lib/ui/local-storage';
import Popper, { PopperRenderProps } from 'lib/ui/Popper';
import { Link } from 'lib/woozie';

import { CollectibleItem } from './CollectibleItem';
import styles from './NFTs.module.css';

const LOCAL_STORAGE_TOGGLE_KEY = 'collectibles-grid:show-items-details';

interface Props {
  scrollToTheTabsBar: EmptyFn;
}

export const CollectiblesTab = memo<Props>(({ scrollToTheTabsBar }) => {
  const chainId = useChainId(true)!;
  const { popup } = useAppEnv();
  const { publicKeyHash } = useAccount();
  const { isSyncing: tokensAreSyncing } = useSyncTokens();
  const metadatasLoading = useTokensMetadataLoadingSelector();

  const [areDetailsShown, setDetailsShown] = useLocalStorage(LOCAL_STORAGE_TOGGLE_KEY, true);
  const [sortOption, setSortOption] = useState<null | SortOptions>(SortOptions.HIGH_TO_LOW);

  const toggleDetailsShown = useCallback(() => void setDetailsShown(val => !val), [setDetailsShown]);

  const { data: collectibles = [], isValidating: readingCollectibles } = useCollectibleTokens(
    chainId,
    publicKeyHash,
    true
  );

  const collectiblesSlugs = useMemoWithCompare(
    () => collectibles.map(collectible => collectible.tokenSlug).sort(),
    [collectibles],
    isEqual
  );

  const { filteredAssets, searchValue, setSearchValue } = useFilteredAssetsSlugs(collectiblesSlugs, false);

  const shouldScrollToTheTabsBar = collectibles.length > 0;
  useEffect(() => void scrollToTheTabsBar(), [shouldScrollToTheTabsBar, scrollToTheTabsBar]);

  const isSyncing = tokensAreSyncing || metadatasLoading || readingCollectibles;

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

                <ManageAssetsButton />
              </div>
            </SearchExplorerClosed>
          </>
        </SearchExplorer>
        {/* <div className="mb-4 w-full flex items-strech">
          <SearchAssetField
            value={searchValue}
            onValueChange={setSearchValue}
            containerClassName="mr-2"
            testID={AssetsSelectors.searchAssetsInputCollectibles}
          />

          <Popper
            placement="bottom-end"
            strategy="fixed"
            popup={props => (
              <ManageButtonDropdown
                {...props}
                areDetailsShown={areDetailsShown}
                toggleDetailsShown={toggleDetailsShown}
              />
            )}
          >
            {({ ref, opened, toggleOpened }) => (
              <ButtonForManageDropdown
                ref={ref}
                opened={opened}
                tooltip={t('manageAssetsList')}
                onClick={toggleOpened}
                testID={AssetsSelectors.manageButton}
                testIDProperties={{ listOf: 'Collectibles' }}
              />
            )}
          </Popper>
        </div> */}

        {filteredAssets.length === 0 ? (
          buildEmptySection(isSyncing)
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {filteredAssets.map(slug => (
                <CollectibleItem
                  key={slug}
                  assetSlug={slug}
                  accountPkh={publicKeyHash}
                  areDetailsShown={areDetailsShown}
                />
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

interface ManageButtonDropdownProps extends PopperRenderProps {
  areDetailsShown: boolean;
  toggleDetailsShown: EmptyFn;
}

const ManageButtonDropdown: FC<ManageButtonDropdownProps> = ({ opened, areDetailsShown, toggleDetailsShown }) => {
  const buttonClassName = 'flex items-center px-3 py-2.5 rounded hover:bg-gray-200 cursor-pointer';

  return (
    <DropdownWrapper
      opened={opened}
      className="origin-top-right p-2 flex flex-col min-w-40"
      style={{ border: 'unset', marginTop: '0.25rem' }}
    >
      <Link
        to={`/manage-assets/${AssetTypesEnum.Collectibles}`}
        className={buttonClassName}
        testID={AssetsSelectors.dropdownManageButton}
        testIDProperties={{ listOf: 'Collectibles' }}
      >
        <EditingIcon className="w-4 h-4 stroke-current fill-current text-gray-600" />
        <span className="text-sm text-gray-600 ml-2 leading-5">
          <T id="manage" />
        </span>
      </Link>

      <Divider className="my-2" />

      <label className={buttonClassName}>
        <Checkbox
          overrideClassNames="h-4 w-4 rounded"
          checked={areDetailsShown}
          onChange={toggleDetailsShown}
          testID={AssetsSelectors.dropdownShowInfoCheckbox}
        />
        <span className="text-sm text-gray-600 ml-2 leading-5">
          <T id="showInfo" />
        </span>
      </label>
    </DropdownWrapper>
  );
};
