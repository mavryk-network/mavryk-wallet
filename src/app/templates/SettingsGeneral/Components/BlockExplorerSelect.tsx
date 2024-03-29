import React, { useMemo, useCallback, FC, useState } from 'react';

import classNames from 'clsx';
import { isEqual } from 'lodash';
import browser from 'webextension-polyfill';

import Flag from 'app/atoms/Flag';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { InputContainer } from 'app/templates/InputContainer/InputContainer';
import { setTestID } from 'lib/analytics';
import { T } from 'lib/i18n';
import { BlockExplorer, useChainId, BLOCK_EXPLORERS, useBlockExplorer } from 'lib/temple/front';
import { isKnownChainId } from 'lib/temple/types';
import { searchAndFilterItems } from 'lib/utils/search-items';

import { SettingsGeneralSelectors } from '../selectors';

const renderOptionContent = (option: BlockExplorer, isSelected: boolean) => (
  <BlockExplorerOptionContent option={option} isSelected={isSelected} />
);

const BlockExplorerSelect = () => {
  const { explorer, setExplorerId } = useBlockExplorer();
  const chainId = useChainId(true)!;
  const [searchValue, setSearchValue] = useState<string>('');

  const options = useMemo(() => {
    if (chainId && isKnownChainId(chainId)) {
      const knownExplorers = BLOCK_EXPLORERS.filter(explorer => explorer.baseUrls.get(chainId));

      return searchBlockExplorer(searchValue, knownExplorers);
    }

    return [];
  }, [chainId, searchValue]);

  const handleBlockExplorerChange = useCallback(
    (option: BlockExplorer) => {
      setExplorerId(option.id);
    },
    [setExplorerId]
  );

  return (
    <div className="mb-4">
      <InputContainer header={<BlockExplorerTitle />}>
        <DropdownSelect
          optionsListClassName="p-2"
          dropdownButtonClassName="px-4 py-14px"
          DropdownFaceContent={<BlockExplorerFieldContent {...explorer} />}
          optionsProps={{
            options,
            noItemsText: 'No items',
            getKey: option => option.id,
            renderOptionContent: option => renderOptionContent(option, isEqual(option, explorer)),
            onOptionChange: handleBlockExplorerChange
          }}
          searchProps={{
            searchValue,
            onSearchChange: event => setSearchValue(event?.target.value)
          }}
        />
      </InputContainer>
    </div>
  );
};

export default BlockExplorerSelect;

const BlockExplorerTitle: FC = () => (
  <h2 className="leading-tight flex flex-col mb-3">
    <span className="text-base-plus text-white">
      <T id="blockExplorer" />
    </span>
  </h2>
);

const BlockExplorerIcon: FC<Pick<BlockExplorer, 'id' | 'name'>> = ({ id, name }) => (
  <Flag alt={name} className="mr-2" src={browser.runtime.getURL(`/misc/explorer-logos/${id}.ico`)} />
);

const BlockExplorerFieldContent: FC<BlockExplorer> = ({ id, name }) => {
  return (
    <div className="flex items-center">
      <BlockExplorerIcon id={id} name={name} />

      <span className="text-base-plus text-white">{name}</span>
    </div>
  );
};

interface BlockExplorerOptionContentProps {
  option: BlockExplorer;
  isSelected?: boolean;
}

const BlockExplorerOptionContent: FC<BlockExplorerOptionContentProps> = ({ option, isSelected }) => {
  return (
    <div
      className={classNames(
        'w-full flex items-center py-3 px-2 rounded',
        isSelected ? 'bg-primary-card' : 'hover:bg-primary-card',
        isSelected ? 'text-white' : 'text-secondary-white'
      )}
    >
      <BlockExplorerIcon id={option.id} name={option.name} />

      <div className="w-full text-left text-base-plus" {...setTestID(SettingsGeneralSelectors.blockExplorerItem)}>
        {option.name}
      </div>
    </div>
  );
};

const searchBlockExplorer = (searchString: string, options: BlockExplorer[]) =>
  searchAndFilterItems(
    options,
    searchString,
    [
      { name: 'name', weight: 1 },
      { name: 'urls', weight: 0.25 }
    ],
    ({ name, baseUrls }) => ({
      name,
      urls: Array.from(baseUrls.values()).map(item => item.transaction)
    })
  );
