import React, { FC, InputHTMLAttributes, useCallback } from 'react';

import classNames from 'clsx';

import CleanButton from 'app/atoms/CleanButton';
import { ReactComponent as SearchIcon } from 'app/icons/search.svg';
import { setTestID, TestIDProps } from 'lib/analytics';

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
  showCloseIcon?: boolean;
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
  showCloseIcon = false,
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
          className={classNames('appearance-none w-full placeholder-white placeholder-opacity-50', className)}
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

        {(Boolean(value) || showCloseIcon) && (
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

export default SearchField;
