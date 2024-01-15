import React, { useMemo, useCallback, FC, useState } from 'react';

import classNames from 'clsx';
import { isEqual } from 'lodash';
import browser from 'webextension-polyfill';

import Flag from 'app/atoms/Flag';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { InputContainer } from 'app/templates/InputContainer/InputContainer';
import { T } from 'lib/i18n';
import { BlockExplorer, useChainId, BLOCK_EXPLORERS, useBlockExplorer } from 'lib/temple/front';
import { DerivationType, isKnownChainId } from 'lib/temple/types';
import { searchAndFilterItems } from 'lib/utils/search-items';

const renderOptionContent = (option: DerivationOption, isSelected: boolean) => (
  <BlockExplorerOptionContent option={option} isSelected={isSelected} />
);

type DerivationOption = {
  type: number;
  name: string;
};

const DERIVATION_TYPES: DerivationOption[] = [
  {
    type: DerivationType.ED25519,
    name: 'ED25519 (tz1...)'
  },
  {
    type: DerivationType.BIP32_ED25519,
    name: 'BIP32_ED25519 (tz1...)'
  },
  {
    type: DerivationType.SECP256K1,
    name: 'SECP256K1 (tz2...)'
  },
  {
    type: DerivationType.P256,
    name: 'P256 (tz3...)'
  }
];

const BlockExplorerSelect = () => {
  const [selectedDerivationOption, setSelectedDerivationOption] = useState<DerivationOption>(DERIVATION_TYPES[0]);
  const [searchValue, setSearchValue] = useState<string>('');

  const handleDerivationOptionChange = useCallback((option: DerivationOption) => {
    const derivationOption = DERIVATION_TYPES.find(({ name }) => option.name === name);

    if (derivationOption) setSelectedDerivationOption(derivationOption);
  }, []);

  return (
    <div className="mb-4">
      <InputContainer header={<BlockExplorerTitle />}>
        <DropdownSelect
          optionsListClassName="p-2"
          dropdownButtonClassName="px-4 py-14px"
          DropdownFaceContent={<BlockExplorerFieldContent {...selectedDerivationOption} />}
          optionsProps={{
            options: DERIVATION_TYPES,
            noItemsText: 'No items',
            getKey: option => option.name,
            renderOptionContent: option =>
              renderOptionContent(option, isEqual(option.name, selectedDerivationOption.name)),
            onOptionChange: handleDerivationOptionChange
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

const BlockExplorerFieldContent: FC<DerivationOption> = ({ name }) => {
  return (
    <div className="flex items-center">
      <span className="text-base-plus text-white">{name}</span>
    </div>
  );
};

interface BlockExplorerOptionContentProps {
  option: DerivationOption;
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
      <div className="w-full text-left text-base-plus">{option.name}</div>
    </div>
  );
};
