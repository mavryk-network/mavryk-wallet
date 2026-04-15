import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';

import { SyncSpinner } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { useLoadPartnersPromo } from 'app/hooks/use-load-partners-promo';
import { useSortAssetsOptions } from 'app/hooks/use-sort-assets-options';
import { useTokensListingLogic } from 'app/hooks/use-tokens-listing-logic';
import { ManageAssetsButton } from 'app/pages/ManageAssets/ManageAssetsButton';
import {
  SearchExplorerClosed,
  SearchExplorerOpened,
  SearchExplorer,
  SearchExplorerIconBtn,
  SearchExplorerFinder,
  SearchExplorerCloseBtn
} from 'app/templates/SearchExplorer';
import { SortButton, SortPopup, SortPopupContent } from 'app/templates/SortPopup';
import { setTestID } from 'lib/analytics';
import { OptimalPromoVariantEnum } from 'lib/apis/optimal';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useEnabledAccountTokensSlugs } from 'lib/assets/hooks';
import { SortOptions, useSortededAssetsSlugs } from 'lib/assets/use-sorted';
import { useCurrentAccountBalances } from 'lib/balances';
import { T } from 'lib/i18n';
import { useAreAssetsLoading, useMainnetTokensScamlistSelector } from 'lib/store/zustand/assets.store';
import { useAccount } from 'lib/temple/front';
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
  const balances = useCurrentAccountBalances();
  const { publicKeyHash } = useAccount();

  const isSyncing = useAreAssetsLoading('tokens');
  const { popup } = useAppEnv();

  const slugs = useEnabledAccountTokensSlugs(true);

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

  const mainnetTokensScamSlugsRecord = useMainnetTokensScamlistSelector();

  const leadingAssets = useMemo(() => [MAV_TOKEN_SLUG], []);

  const { filteredAssets, searchValue, setSearchValue } = useTokensListingLogic(
    slugs,
    isZeroBalancesHidden,
    leadingAssets,
    true
  );

  const sortedSlugs = useSortededAssetsSlugs(sortOption, filteredAssets, balances);

  const memoizedSortAssetsOptions = useSortAssetsOptions(sortOption, setSortOption);

  const [searchFocused, setSearchFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchValueExist = useMemo(() => Boolean(searchValue), [searchValue]);

  const activeAssetSlug = useMemo(() => {
    return searchFocused && searchValueExist && sortedSlugs[activeIndex] ? sortedSlugs[activeIndex] : null;
  }, [sortedSlugs, searchFocused, searchValueExist, activeIndex]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sortedSlugs.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 76,
    overscan: 5
  });
  useLoadPartnersPromo(OptimalPromoVariantEnum.Token);

  useEffect(() => {
    if (activeIndex !== 0 && activeIndex >= sortedSlugs.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, sortedSlugs.length]);

  const handleSearchFieldFocus = useCallback(() => void setSearchFocused(true), [setSearchFocused]);
  const handleSearchFieldBlur = useCallback(() => void setSearchFocused(false), [setSearchFocused]);

  const clearInput = useCallback(() => {
    setSearchValue('');
  }, []);

  useEffect(() => {
    if (!activeAssetSlug) return;

    const handleKeyup = (evt: KeyboardEvent) => {
      switch (evt.key) {
        case 'Enter':
          navigate(toExploreAssetLink(activeAssetSlug));
          break;

        case 'ArrowDown':
          setActiveIndex(i => {
            const next = Math.min(i + 1, sortedSlugs.length - 1);
            virtualizer.scrollToIndex(next, { align: 'auto' });
            return next;
          });
          break;

        case 'ArrowUp':
          setActiveIndex(i => {
            const prev = i > 0 ? i - 1 : 0;
            virtualizer.scrollToIndex(prev, { align: 'auto' });
            return prev;
          });
          break;
      }
    };

    window.addEventListener('keyup', handleKeyup);
    return () => window.removeEventListener('keyup', handleKeyup);
  }, [activeAssetSlug, setActiveIndex, sortedSlugs.length]);

  return (
    <div className={clsx('w-full mx-auto relative', popup ? 'max-w-sm' : 'max-w-screen-xxs')}>
      <div className={clsx('mt-3 w-full flex justify-end')}>
        <SearchExplorer>
          <>
            <SearchExplorerOpened>
              <div className={clsx('w-full flex justify-end bg-primary-bg', popup && 'px-4', styles.searchWrapper)}>
                <SearchExplorerFinder
                  value={searchValue}
                  onValueChange={setSearchValue}
                  onFocus={handleSearchFieldFocus}
                  onBlur={handleSearchFieldBlur}
                  containerClassName="mr-2"
                  testID={AssetsSelectors.searchAssetsInputTokens}
                />
                <SearchExplorerCloseBtn onClick={clearInput} />
              </div>
            </SearchExplorerOpened>
            <SearchExplorerClosed>
              <div
                className={clsx(
                  'flex justify-end items-center pl-4 w-fit',
                  popup && 'pr-12px',
                  styles.searchWrapper,
                  styles.closed
                )}
              >
                <SearchExplorerIconBtn />

                <SortPopup>
                  <SortButton />
                  <SortPopupContent
                    items={memoizedSortAssetsOptions}
                    on={isZeroBalancesHidden}
                    toggle={toggleHideZeroBalances}
                    alternativeLogic={!popup}
                  />
                </SortPopup>

                <ManageAssetsButton />
              </div>
            </SearchExplorerClosed>
          </>
        </SearchExplorer>
      </div>

      {/* {isEnabledAdsBanner && <AcceptAdsBanner />} */}
      <div className={clsx('mb-4', popup && 'px-4')}>
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
        <>
          <div
            ref={scrollContainerRef}
            className="w-full overflow-y-auto rounded-md text-white text-sm leading-tight"
            style={{ maxHeight: popup ? '60vh' : '70vh' }}
          >
            <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
              {virtualizer.getVirtualItems().map(virtualRow => {
                const slug = sortedSlugs[virtualRow.index];
                return (
                  <div
                    key={slug}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <ListItem
                      publicKeyHash={publicKeyHash}
                      assetSlug={slug}
                      scam={mainnetTokensScamSlugsRecord[slug]}
                      active={activeAssetSlug ? slug === activeAssetSlug : false}
                      onClick={handleAssetOpen}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <TokenDetailsPopup
            publicKeyHash={publicKeyHash}
            assetSlug={assetSlug}
            isOpen={assetSlug.length > 0}
            onRequestClose={handleAssetClose}
          />
        </>
      )}

      {isSyncing && <SyncSpinner className="mt-4" />}
    </div>
  );
};
