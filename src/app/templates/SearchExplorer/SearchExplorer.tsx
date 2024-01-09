import React, { FC, useCallback, createContext, useState, useMemo, useContext, CSSProperties } from 'react';

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
  memoizedStyles: CSSProperties;
};

export const searchExplorerContext = createContext<SearchExplorerContextType>(undefined!);

export const SearchExplorer: FC<SearchExplorerProps> = ({ isExplored = false, children }) => {
  const [explored, setExplored] = useState(isExplored);

  const memoizedStyles = useInitialOffAnimation();

  const toggleExplorer = useCallback(() => {
    setExplored(!explored);
  }, [explored]);

  const memoizedSerachExplorerContextValue = useMemo(
    () => ({
      explored,
      toggleExplorer,
      memoizedStyles
    }),
    [explored, toggleExplorer, memoizedStyles]
  );

  return (
    <searchExplorerContext.Provider value={memoizedSerachExplorerContextValue}>
      {children}
    </searchExplorerContext.Provider>
  );
};

const useSearchExplorer = () => {
  const ctx = useContext(searchExplorerContext);

  if (!ctx) {
    throw new Error('useSearchExplorer must be used within <SerachExplorer /> provider');
  }

  return ctx;
};

export const SearchExplorerFinder: FC<SearchAssetFieldProps> = props => {
  const { toggleExplorer, explored, memoizedStyles } = useSearchExplorer();

  return (
    <div className={classNames('w-full', explored && styles.explorerSearch)} style={memoizedStyles}>
      <SearchAssetField {...props} cleanButtonCb={toggleExplorer} searchIconCb={toggleExplorer} />
    </div>
  );
};

export const SearchExplorerIconBtn: FC = () => {
  const { toggleExplorer, explored, memoizedStyles } = useSearchExplorer();

  return (
    <div onClick={toggleExplorer} className={classNames(!explored && styles.explorerHideSearch)} style={memoizedStyles}>
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
