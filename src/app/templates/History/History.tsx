import React, { Fragment, memo, useCallback, useMemo, useState } from 'react';

import classNames from 'clsx';
import InfiniteScroll from 'react-infinite-scroll-component';

import { SyncSpinner } from 'app/atoms';
import { ReactComponent as LayersIcon } from 'app/icons/layers.svg';
import { ManageAssetsButton } from 'app/pages/ManageAssets/ManageAssetsButton';
import { SortOptions } from 'lib/assets/use-sorted';
import { T } from 'lib/i18n/react';
import { useAccount } from 'lib/temple/front';
import { UserHistoryItem } from 'lib/temple/history';

import useHistory from '../../../lib/temple/history/hook';
import { PartnersPromotion, PartnersPromotionVariant } from '../../atoms/partners-promotion';
import {
  SearchExplorer,
  SearchExplorerClosed,
  SearchExplorerFinder,
  SearchExplorerIconBtn,
  SearchExplorerOpened
} from '../SearchExplorer';
import { SortButton, SortListItemType, SortPopup, SortPopupContent } from '../SortPopup';
import styles from './history.module.css';
import { HistoryDetailsPopup } from './HistoryDetailsPopup';
import { HistoryItem } from './HistoryItem';
// import { txMocked, StakedMock } from './mock';

const INITIAL_NUMBER = 60;
const LOAD_STEP = 30;

const cleanBtnStyles = { backgroundColor: '#202020', borderRadius: 100 };

interface Props {
  assetSlug?: string;
}

// const userHistory = [StakedMock];

export const HistoryComponent: React.FC<Props> = memo(({ assetSlug }) => {
  const { loading, reachedTheEnd, list: userHistory, loadMore } = useHistory(INITIAL_NUMBER, assetSlug);

  // console.log('Logging user history in the HistoryComponent:', userHistory);

  const { publicKeyHash: accountAddress } = useAccount();

  // useLoadPartnersPromo();

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

  // search
  const [searchValue, setSearchValue] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  // popup
  const [isOpen, setIsOpen] = useState(false);
  const [activeHistoryItem, setActiveHistoryItem] = useState<UserHistoryItem | null>(null);

  const handleSearchFieldFocus = useCallback(() => void setSearchFocused(true), [setSearchFocused]);
  const handleSearchFieldBlur = useCallback(() => void setSearchFocused(false), [setSearchFocused]);

  const handleRequestClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleItemClick = useCallback(
    (hash: string) => {
      setIsOpen(true);

      setActiveHistoryItem(userHistory.find(item => item.hash === hash) ?? null);
    },
    [userHistory]
  );

  if (userHistory.length === 0 && !loading && reachedTheEnd) {
    return (
      <div className={classNames('h-full my-auto mt-14', 'flex flex-col items-center justify-center', 'text-white')}>
        <LayersIcon className="w-16 h-auto mb-2 stroke-current" />

        <h3 className="text-base-plus text-white text-center" style={{ maxWidth: '20rem' }}>
          <T id="noOperationsFound" />
        </h3>
      </div>
    );
  }

  const retryInitialLoad = () => loadMore(INITIAL_NUMBER);
  const loadMoreActivities = () => loadMore(LOAD_STEP);

  const loadNext = userHistory.length === 0 ? retryInitialLoad : loadMoreActivities;

  const onScroll = loading || reachedTheEnd ? undefined : buildOnScroll(loadNext);

  return (
    <div className="w-full max-w-sm mx-auto h-full relative">
      <div className={classNames('mt-3 w-full mx-4')}>
        <SearchExplorer>
          <>
            <SearchExplorerOpened>
              <div className={classNames('w-full flex justify-end', styles.searchWrapper)}>
                <SearchExplorerFinder
                  value={searchValue}
                  onValueChange={setSearchValue}
                  onFocus={handleSearchFieldFocus}
                  onBlur={handleSearchFieldBlur}
                  containerClassName="mr-2"
                />
              </div>
            </SearchExplorerOpened>
            <SearchExplorerClosed>
              <div className={classNames('flex justify-end items-center', styles.searchWrapper)}>
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
      </div>

      <div className={classNames('my-3 flex flex-col')}>
        <InfiniteScroll
          dataLength={userHistory.length}
          hasMore={reachedTheEnd === false}
          next={loadNext}
          loader={loading && <SyncSpinner className="mt-4" />}
          onScroll={onScroll}
        >
          {userHistory.map((historyItem, index) => (
            <Fragment key={historyItem.hash}>
              {/* I want to render the list of userHistory here in flex box items */}
              <HistoryItem
                address={accountAddress}
                historyItem={historyItem}
                slug={assetSlug}
                handleItemClick={handleItemClick}
              />
              {index === 0 && <PartnersPromotion variant={PartnersPromotionVariant.Image} />}
            </Fragment>
          ))}
        </InfiniteScroll>
      </div>
      <HistoryDetailsPopup isOpen={isOpen} onRequestClose={handleRequestClose} historyItem={activeHistoryItem} />
    </div>
  );
});

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
