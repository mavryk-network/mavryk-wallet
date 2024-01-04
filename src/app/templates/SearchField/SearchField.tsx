import React, { FC, InputHTMLAttributes, useCallback, createContext, useState, useMemo, useContext } from 'react';

import classNames from 'clsx';

import CleanButton from 'app/atoms/CleanButton';
import { useInitialOffAnimation } from 'app/hooks/use-initial-off-animation';
import { ReactComponent as SearchIcon } from 'app/icons/search.svg';
import { setTestID, TestIDProps } from 'lib/analytics';

import styles from './SearchField.module.css';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement>, TestIDProps {
  bottomOffset?: string;
  containerClassName?: string;
  searchIconClassName?: string;
  searchIconWrapperClassName?: string;
  searchIconCb?: () => void;
  cleanButtonStyle?: React.CSSProperties;
  cleanButtonIconStyle?: React.CSSProperties;
  cleanButtonCb?: () => void;
  value: string;
  onValueChange: (value: string) => void;
}

const SearchField: FC<SearchFieldProps> = ({
  bottomOffset = '0.45rem',
  className,
  containerClassName,
  value,
  onValueChange,
  searchIconClassName,
  searchIconWrapperClassName,
  searchIconCb,
  cleanButtonStyle,
  cleanButtonIconStyle,
  testID,
  cleanButtonCb,
  ...rest
}) => {
  const handleChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange(evt.target.value);
    },
    [onValueChange]
  );

  const handleClean = useCallback(() => {
    onValueChange('');
    cleanButtonCb?.();
  }, [onValueChange, cleanButtonCb]);

  return (
    <div className={classNames('w-full flex flex-col', containerClassName)}>
      <div className="relative flex items-stretch">
        <input
          type="text"
          className={classNames('appearance-none w-full', className)}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={handleChange}
          {...setTestID(testID)}
          {...rest}
        />

        <div
          className={classNames(
            'absolute left-0 top-0 bottom-0 flex items-center cursor-pointer',
            searchIconWrapperClassName
          )}
          onClick={searchIconCb}
        >
          <SearchIcon className={classNames('stroke-1', searchIconClassName)} />
        </div>

        {Boolean(value) && (
          <CleanButton
            bottomOffset={bottomOffset}
            style={cleanButtonStyle}
            iconStyle={cleanButtonIconStyle}
            onClick={handleClean}
          />
        )}
      </div>
    </div>
  );
};

// Serach explorer logic ----
export type SearchExplorerProps = {
  isExplored?: boolean;
  children: JSX.Element;
};

export type SearchExplorerContextType = {
  explored: boolean;
  toggleExplorer: () => void;
};

export const searchExplorerContext = createContext<SearchExplorerContextType>(undefined!);

export const SearchExplorer: FC<SearchExplorerProps> = ({ isExplored = false, children }) => {
  const [explored, setExplored] = useState(isExplored);

  const toggleExplorer = useCallback(() => {
    setExplored(!explored);
  }, [explored]);

  const memoizedSerachExplorerContextValue = useMemo(
    () => ({
      explored,
      toggleExplorer
    }),
    [explored, toggleExplorer]
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

export const SearchExplorerOpened: FC<SearchFieldProps> = props => {
  const { toggleExplorer, explored } = useSearchExplorer();
  const memoizedStyles = useInitialOffAnimation();

  return explored ? (
    <div className={classNames('w-full', styles.explorerSearch)} style={memoizedStyles}>
      <SearchField {...props} cleanButtonCb={toggleExplorer} searchIconCb={toggleExplorer} />
    </div>
  ) : null;
};

export const SearchExplorerClosed: FC = () => {
  const { toggleExplorer, explored } = useSearchExplorer();
  const memoizedStyles = useInitialOffAnimation();

  return !explored ? (
    <div onClick={toggleExplorer} className={styles.explorerHideSearch} style={memoizedStyles}>
      <SearchIcon className={classNames('w-6 h-auto stroke-secondary-whit cursor-pointer')} />
    </div>
  ) : null;
};

export default SearchField;
