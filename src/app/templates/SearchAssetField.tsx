import React, { FC, forwardRef, memo } from 'react';

import clsx from 'clsx';

import SearchField, { SearchFieldProps } from 'app/templates/SearchField/SearchField';
import { t } from 'lib/i18n';

export type SearchAssetFieldProps = SearchFieldProps;

const SearchAssetField = memo(
  forwardRef<HTMLInputElement, SearchAssetFieldProps>(
    ({ className, placeholder = t('searchAssets'), ...rest }, ref) => (
      <SearchField
        ref={ref}
        className={clsx(
          'py-2 pl-8 pr-6 bg-primary-card',
          'rounded-lg outline-none',
          'transition ease-in-out duration-200',
          'text-white text-sm',
          'focus:text-white',
          className
        )}
        placeholder={placeholder}
        searchIconClassName="h-5 w-auto"
        searchIconWrapperClassName="px-2 text-gray-600"
        {...rest}
      />
    )
  )
);

export default SearchAssetField;
