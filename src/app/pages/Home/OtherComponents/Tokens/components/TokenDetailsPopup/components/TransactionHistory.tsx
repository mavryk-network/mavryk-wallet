import React, { Fragment, useCallback, useMemo, useState } from 'react';

import classNames from 'clsx';
import InfiniteScroll from 'react-infinite-scroll-component';

import { SyncSpinner } from 'app/atoms';
import { PartnersPromotion, PartnersPromotionVariant } from 'app/atoms/partners-promotion';
import { useAppEnv } from 'app/env';
import { useLoadPartnersPromo } from 'app/hooks/use-load-partners-promo';
import { ReactComponent as LayersIcon } from 'app/icons/layers.svg';
import {
  SearchExplorer,
  SearchExplorerClosed,
  SearchExplorerFinder,
  SearchExplorerIconBtn,
  SearchExplorerOpened
} from 'app/templates/SearchExplorer';
import { SortButton, SortListItemType, SortPopup, SortPopupContent } from 'app/templates/SortPopup';
import { SortOptions } from 'lib/assets/use-sorted';
import { T } from 'lib/i18n/react';
import useActivities from 'lib/temple/activity-new/hook';
import { useAccount } from 'lib/temple/front';

import styles from './transactionHistory.module.css';
import { TransactionHistoryItem } from './TransactionHistoryItem';

const INITIAL_NUMBER = 30;
const LOAD_STEP = 30;

const cleanBtnStyles = { backgroundColor: '#202020', borderRadius: 100 };

interface Props {
  assetSlug?: string;
}

export const TransactionHistory: React.FC<Props> = ({ assetSlug }) => {
  const { loading, reachedTheEnd, list: activities, loadMore } = useActivities(INITIAL_NUMBER, assetSlug);

  const { popup } = useAppEnv();

  const { publicKeyHash: accountAddress } = useAccount();

  useLoadPartnersPromo();

  if (activities.length === 0 && !loading && reachedTheEnd) {
    return (
      <div className={classNames('mt-4 mb-12', 'flex flex-col items-center justify-center', 'text-gray-500')}>
        <LayersIcon className="w-16 h-auto mb-2 stroke-current" />

        <h3 className="text-sm font-light text-center" style={{ maxWidth: '20rem' }}>
          <T id="noOperationsFound" />
        </h3>
      </div>
    );
  }

  const retryInitialLoad = () => loadMore(INITIAL_NUMBER);
  const loadMoreActivities = () => loadMore(LOAD_STEP);

  const loadNext = activities.length === 0 ? retryInitialLoad : loadMoreActivities;

  const onScroll = loading || reachedTheEnd ? undefined : buildOnScroll(loadNext);

  // sort
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

  console.log(activities);

  // search
  const [searchValue, setSearchValue] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const handleSearchFieldFocus = useCallback(() => void setSearchFocused(true), [setSearchFocused]);
  const handleSearchFieldBlur = useCallback(() => void setSearchFocused(false), [setSearchFocused]);

  return (
    <section>
      <div className="px-4 mb-3">
        <div className="flex items-center justify-between relative">
          <span className="text-base-plus text-white">
            <T id="history" />
          </span>
          <div
            style={{ transform: 'translateY(-50%)' }}
            className="flex items-center gap-2 w-full h-8 top-1/2 left-0 justify-end absolute"
          >
            <SearchExplorer>
              <>
                <SearchExplorerOpened>
                  <div className={classNames('w-full flex justify-end')}>
                    <SearchExplorerFinder
                      value={searchValue}
                      onValueChange={setSearchValue}
                      onFocus={handleSearchFieldFocus}
                      onBlur={handleSearchFieldBlur}
                      containerClassName="mr-2"
                      className={styles.inputBg}
                      cleanButtonIconStyle={cleanBtnStyles}
                      // testID={AssetsSelectors.searchAssetsInputTokens}
                    />
                  </div>
                </SearchExplorerOpened>
                <SearchExplorerClosed>
                  <div className={classNames('flex justify-end items-center')}>
                    <SearchExplorerIconBtn />

                    <SortPopup>
                      <SortButton />
                      <SortPopupContent items={memoizedSortAssetsOptions} />
                    </SortPopup>
                  </div>
                </SearchExplorerClosed>
              </>
            </SearchExplorer>
          </div>
        </div>
      </div>
      <div className="w-full max-w-sm mx-auto">
        <div className={classNames('flex flex-col')}>
          <InfiniteScroll
            dataLength={activities.length}
            hasMore={reachedTheEnd === false}
            next={loadNext}
            loader={loading && <SyncSpinner className="mt-4" />}
            onScroll={onScroll}
          >
            {activities.map((activity, index) => (
              <Fragment key={activity.hash}>
                <TransactionHistoryItem address={accountAddress} activity={activity} slug={assetSlug} />
                {index === 0 && <PartnersPromotion variant={PartnersPromotionVariant.Image} />}
              </Fragment>
            ))}
          </InfiniteScroll>
        </div>
      </div>
    </section>
  );
};

/**
 * Build onscroll listener to trigger next loading, when fetching data resulted in error.
 * `InfiniteScroll.props.next` won't be triggered in this case.
 */
const buildOnScroll =
  (next: EmptyFn) =>
  ({ target }: { target: EventTarget | null }) => {
    const elem: HTMLElement =
      target instanceof Document ? (target.scrollingElement! as HTMLElement) : (target as HTMLElement);
    const atBottom = 0 === elem.offsetHeight - elem.clientHeight - elem.scrollTop;
    if (atBottom) next();
  };
