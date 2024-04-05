import React, { FC, useCallback, createContext, useState, useMemo, useContext, memo } from 'react';

import classNames from 'clsx';

import { useInitialOffAnimation } from 'app/hooks/use-initial-off-animation';
import { ReactComponent as SearchIcon } from 'app/icons/search.svg';

import SearchAssetField, { SearchAssetFieldProps } from '../SearchAssetField';

import styles from './SearchExplorer.module.css';

export type SearchExplorerProps = {
  isExplored?: boolean;
  children: JSX.Element;
};

export type SearchExplorerContextType = {
  explored: boolean;
  toggleExplorer: () => void;
  allowAnimation: boolean;
};

export const searchExplorerContext = createContext<SearchExplorerContextType>(undefined!);

export const SearchExplorer: FC<SearchExplorerProps> = memo(({ isExplored = false, children }) => {
  const [explored, setExplored] = useState(isExplored);
  const allowAnimationRef = useInitialOffAnimation();

  const toggleExplorer = useCallback(() => {
    setExplored(!explored);
  }, [explored]);

  const memoizedSerachExplorerContextValue = useMemo(
    () => ({
      explored,
      toggleExplorer,
      allowAnimation: allowAnimationRef.current
    }),
    [explored, toggleExplorer]
  );

  return (
    <searchExplorerContext.Provider value={memoizedSerachExplorerContextValue}>
      {children}
    </searchExplorerContext.Provider>
  );
});

const useSearchExplorer = () => {
  const ctx = useContext(searchExplorerContext);

  if (!ctx) {
    throw new Error('useSearchExplorer must be used within <SerachExplorer /> provider');
  }

  return ctx;
};

export const SearchExplorerFinder: FC<SearchAssetFieldProps> = props => {
  const { toggleExplorer, explored, allowAnimation } = useSearchExplorer();

  return (
    <div className={classNames('w-full', explored && allowAnimation && styles.explorerSearch)}>
      <SearchAssetField {...props} cleanButtonCb={toggleExplorer} searchIconCb={toggleExplorer} showCloseIcon />
    </div>
  );
};

export const SearchExplorerIconBtn: FC = () => {
  const { toggleExplorer, explored, allowAnimation } = useSearchExplorer();

  return (
    <div
      onClick={toggleExplorer}
      className={classNames('animate-none', !explored && allowAnimation && styles.explorerHideSearch)}
    >
      <SearchIcon className={classNames('w-6 h-auto stroke-secondary-whit cursor-pointer')} />
    </div>
  );
};

export const SearchExplorerOpened: FC<{ children: JSX.Element }> = ({ children }) => {
  const { explored } = useSearchExplorer();

  return explored ? children : null;
};

export const SearchExplorerClosed: FC<{ children: JSX.Element }> = ({ children }) => {
  const { explored } = useSearchExplorer();

  return explored ? null : children;
};
