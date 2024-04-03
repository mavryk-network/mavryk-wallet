import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { ChainIds } from '@mavrykdynamics/taquito';
import clsx from 'clsx';

import { SyncSpinner } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { useLoadPartnersPromo } from 'app/hooks/use-load-partners-promo';
import { useTokensListingLogic } from 'app/hooks/use-tokens-listing-logic';
import { ManageAssetsButton } from 'app/pages/ManageAssets/ManageAssetsButton';
import { useAreAssetsLoading, useMainnetTokensScamlistSelector } from 'app/store/assets/selectors';
import {
  SearchExplorerClosed,
  SearchExplorerOpened,
  SearchExplorer,
  SearchExplorerIconBtn,
  SearchExplorerFinder
} from 'app/templates/SearchExplorer';
import { SortButton, SortListItemType, SortPopup, SortPopupContent } from 'app/templates/SortPopup';
import { setTestID } from 'lib/analytics';
import { OptimalPromoVariantEnum } from 'lib/apis/optimal';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useEnabledAccountTokensSlugs } from 'lib/assets/hooks';
import { SortOptions, useSortededAssetsSlugs } from 'lib/assets/use-sorted';
import { useCurrentAccountBalances } from 'lib/balances';
import { T } from 'lib/i18n';
import { useAccount, useChainId } from 'lib/temple/front';
import { useLocalStorage } from 'lib/ui/local-storage';
import { navigate } from 'lib/woozie';

import { HomeSelectors } from '../../Home.selectors';
import { AssetsSelectors } from '../Assets.selectors';

import { ListItem } from './components/ListItem';
import { TokenDetailsPopup } from './components/TokenDetailsPopup';
import { StakeTezosTag } from './components/TokenTag/DelegateTag';
import styles from './Tokens.module.css';
import { toExploreAssetLink } from './utils';

const LOCAL_STORAGE_TOGGLE_KEY = 'tokens-list:hide-zero-balances';

export const TokensTab: FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const chainId = useChainId(true)!;
  const balances = useCurrentAccountBalances();
  const { publicKeyHash } = useAccount();

  const isSyncing = useAreAssetsLoading('tokens');
  const { popup } = useAppEnv();

  const slugs = useEnabledAccountTokensSlugs();

  const [isZeroBalancesHidden, setIsZeroBalancesHidden] = useLocalStorage(LOCAL_STORAGE_TOGGLE_KEY, false);
  const [sortOption, setSortOption] = useState<null | SortOptions>(SortOptions.HIGH_TO_LOW);
  const [assetSlug, setAssetSlug] = useState('');

  const handleAssetOpen = useCallback((assetSlug: string) => {
    setAssetSlug(assetSlug);
  }, []);

  const handleAssetClose = useCallback(() => {
    setAssetSlug('');
  }, []);

  const toggleHideZeroBalances = useCallback(
    () => void setIsZeroBalancesHidden(val => !val),
    [setIsZeroBalancesHidden]
  );

  // const slugs = useMemoWithCompare(() => tokens.map(({ tokenSlug }) => tokenSlug).sort(), [tokens], isEqual);
  const mainnetTokensScamSlugsRecord = useMainnetTokensScamlistSelector();

  const leadingAssets = useMemo(() => (chainId === ChainIds.MAINNET ? [MAV_TOKEN_SLUG] : [MAV_TOKEN_SLUG]), [chainId]);

  const { filteredAssets, searchValue, setSearchValue } = useTokensListingLogic(
    slugs,
    isZeroBalancesHidden,
    leadingAssets
  );

  const sortedSlugs = useSortededAssetsSlugs(sortOption, filteredAssets, balances);

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

  const [searchFocused, setSearchFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchValueExist = useMemo(() => Boolean(searchValue), [searchValue]);

  const activeAssetSlug = useMemo(() => {
    return searchFocused && searchValueExist && sortedSlugs[activeIndex] ? sortedSlugs[activeIndex] : null;
  }, [sortedSlugs, searchFocused, searchValueExist, activeIndex]);

  const tokensView = useMemo<Array<JSX.Element>>(() => {
    const tokensJsx = sortedSlugs.map(assetSlug => (
      <ListItem
        key={assetSlug}
        publicKeyHash={publicKeyHash}
        assetSlug={assetSlug}
        scam={mainnetTokensScamSlugsRecord[assetSlug]}
        active={activeAssetSlug ? assetSlug === activeAssetSlug : false}
        onClick={handleAssetOpen}
      />
    ));

    // if (sortedSlugs.length < 5) {
    //   tokensJsx.push(<PartnersPromotion key="promo-token-item" variant={PartnersPromotionVariant.Text} />);
    // } else {
    //   tokensJsx.splice(1, 0, <PartnersPromotion key="promo-token-item" variant={PartnersPromotionVariant.Text} />);
    // }

    return tokensJsx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedSlugs, activeAssetSlug, balances, sortOption]);

  useLoadPartnersPromo(OptimalPromoVariantEnum.Token);

  useEffect(() => {
    if (activeIndex !== 0 && activeIndex >= sortedSlugs.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, sortedSlugs.length]);

  const handleSearchFieldFocus = useCallback(() => void setSearchFocused(true), [setSearchFocused]);
  const handleSearchFieldBlur = useCallback(() => void setSearchFocused(false), [setSearchFocused]);

  useEffect(() => {
    if (!activeAssetSlug) return;

    const handleKeyup = (evt: KeyboardEvent) => {
      switch (evt.key) {
        case 'Enter':
          navigate(toExploreAssetLink(activeAssetSlug));
          break;

        case 'ArrowDown':
          setActiveIndex(i => i + 1);
          break;

        case 'ArrowUp':
          setActiveIndex(i => (i > 0 ? i - 1 : 0));
          break;
      }
    };

    window.addEventListener('keyup', handleKeyup);
    return () => window.removeEventListener('keyup', handleKeyup);
  }, [activeAssetSlug, setActiveIndex]);

  return (
    <div className="w-full max-w-sm mx-auto relative">
      <div className={clsx('mt-3 w-full', popup && 'mx-4')}>
        <SearchExplorer>
          <>
            <SearchExplorerOpened>
              <div className={clsx('w-full flex justify-end', styles.searchWrapper)}>
                <SearchExplorerFinder
                  value={searchValue}
                  onValueChange={setSearchValue}
                  onFocus={handleSearchFieldFocus}
                  onBlur={handleSearchFieldBlur}
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
                  <SortPopupContent
                    items={memoizedSortAssetsOptions}
                    on={isZeroBalancesHidden}
                    toggle={toggleHideZeroBalances}
                  />
                </SortPopup>

                <ManageAssetsButton />
              </div>
            </SearchExplorerClosed>
          </>
        </SearchExplorer>
      </div>

      {/* {isEnabledAdsBanner && <AcceptAdsBanner />} */}
      <div className="px-4 mb-4">
        <StakeTezosTag />
      </div>

      {sortedSlugs.length === 0 ? (
        <div className="pt-20 pb-8 flex flex-col items-center justify-center text-white">
          <p className="mb-2 flex items-center justify-center text-white text-base-plus">
            <span {...setTestID(HomeSelectors.emptyStateText)}>
              <T id="noAssetsFound" />
            </span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col w-full overflow-hidden rounded-md text-white text-sm leading-tight">
          {tokensView}
          <TokenDetailsPopup
            publicKeyHash={publicKeyHash}
            assetSlug={assetSlug}
            isOpen={assetSlug.length > 0}
            onRequestClose={handleAssetClose}
          />
        </div>
      )}

      {isSyncing && <SyncSpinner className="mt-4" />}
    </div>
  );
};
