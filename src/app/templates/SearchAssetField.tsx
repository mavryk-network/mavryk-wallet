import React, { FC, memo } from 'react';

import clsx from 'clsx';

import {
  SearchExplorerClosed,
  SearchExplorerOpened,
  SearchExplorer,
  SearchFieldProps
} from 'app/templates/SearchField/SearchField';
import { t } from 'lib/i18n';

type SearchAssetFieldProps = SearchFieldProps;

const SearchAssetField: FC<SearchAssetFieldProps> = memo(({ className, ...rest }) => (
  <SearchExplorer>
    <>
      <SearchExplorerOpened
        className={clsx(
          'py-2 pl-8 pr-2 bg-primary-card',
          'rounded-lg outline-none',
          'transition ease-in-out duration-200',
          'text-white text-sm leading-tight',
          'placeholder-secondary-white focus:text-white',
          className
        )}
        placeholder={t('searchAssets')}
        searchIconClassName="h-5 w-auto"
        searchIconWrapperClassName="px-2 text-gray-600"
        {...rest}
      />
      <SearchExplorerClosed />
    </>
  </SearchExplorer>
));

export default SearchAssetField;
