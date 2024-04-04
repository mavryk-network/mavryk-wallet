import React, { FC, memo, useCallback, useMemo, useState } from 'react';

import classNames from 'clsx';
import { isEqual } from 'lodash';
import { useDebounce } from 'use-debounce';

import Money from 'app/atoms/Money';
import { AssetIcon } from 'app/templates/AssetIcon';
import Balance from 'app/templates/Balance';
import { setTestID, setAnotherSelector } from 'lib/analytics';
import { searchAssetsWithNoMeta } from 'lib/assets/search.utils';
import { T, t } from 'lib/i18n';
import { useAssetMetadata, getAssetSymbol, useGetAssetMetadata } from 'lib/metadata';
import { useAccount } from 'lib/temple/front';

import { AssetItemContent } from './AssetItemContent';
import { DropdownSelect } from './DropdownSelect/DropdownSelect';
import { InputContainer } from './InputContainer/InputContainer';
import { SendFormSelectors } from './SendForm/selectors';

interface Props {
  value: string;
  slugs: string[];
  onChange?: (assetSlug: string) => void;
  className?: string;
  testIDs?: {
    main: string;
    select: string;
    searchInput: string;
  };
}

const renderOptionContent = (slug: string, selected: boolean) => <AssetOptionContent slug={slug} selected={selected} />;

const AssetSelect = memo<Props>(({ value, slugs, onChange, className, testIDs }) => {
  const getAssetMetadata = useGetAssetMetadata();

  const [searchString, _] = useState<string>('');
  const [searchStringDebounced] = useDebounce(searchString, 300);

  const searchItems = useCallback(
    (searchString: string) => searchAssetsWithNoMeta(searchString, slugs, getAssetMetadata, s => s),
    [slugs, getAssetMetadata]
  );

  const searchedOptions = useMemo(
    () => (searchStringDebounced ? searchItems(searchStringDebounced) : slugs),
    [searchItems, searchStringDebounced, slugs]
  );

  const handleChange = useCallback(
    (slug: string) => {
      onChange?.(slug);
    },
    [onChange]
  );

  return (
    <InputContainer className={className} header={<AssetSelectTitle />}>
      <DropdownSelect
        DropdownFaceContent={<AssetFieldContent slug={value} />}
        testIds={{ dropdownTestId: testIDs?.main }}
        dropdownButtonClassName="p-4 bg-primary-card h-66px"
        fontContentWrapperClassname="border border-transparent rounded-xl"
        dropdownWrapperClassName="border-none rounded-2xl-plus max-h-80"
        optionsListClassName="bg-primary-card"
        // searchProps={{
        //   testId: testIDs?.searchInput,
        //   searchValue: searchString,
        //   onSearchChange: event => setSearchString(event.target.value)
        // }}
        optionsProps={{
          options: searchedOptions,
          noItemsText: t('noAssetsFound'),
          getKey: option => option,
          onOptionChange: handleChange,
          renderOptionContent: asset => renderOptionContent(asset, isEqual(asset, value))
        }}
      />
    </InputContainer>
  );
});

export default AssetSelect;

const AssetSelectTitle: FC = () => (
  <h2 className="leading-tight flex flex-col mb-3">
    <span className="text-base-plus text-white">
      <T id="asset" />
    </span>
  </h2>
);

export const AssetFieldContent: FC<{ slug: string }> = ({ slug }) => {
  const account = useAccount();
  const metadata = useAssetMetadata(slug);

  return (
    <div className="flex items-center">
      <AssetIcon assetSlug={slug} className="mr-1" size={32} />

      <Balance assetSlug={slug} address={account.publicKeyHash}>
        {balance => (
          <div className="flex flex-col items-start">
            <span className="text-base-plus text-white">{getAssetSymbol(metadata)}</span>
            <span className="text-sm text-secondary-white flex items-baseline">
              <Money smallFractionFont={false}>{balance}</Money>&nbsp;
              <span>{getAssetSymbol(metadata)}</span>
            </span>
          </div>
        )}
      </Balance>
    </div>
  );
};

export const AssetOptionContent: FC<{ slug: string; selected: boolean }> = ({ slug, selected }) => {
  return (
    <div
      className={classNames(
        'flex items-center w-full p-4 h-14',
        selected ? 'bg-gray-710' : 'bg-primary-card hover:bg-gray-710'
      )}
      {...setTestID(SendFormSelectors.assetDropDownItem)}
      {...setAnotherSelector('slug', slug)}
    >
      <AssetIcon assetSlug={slug} className="mr-2" size={32} />

      <AssetItemContent slug={slug} />
    </div>
  );
};
