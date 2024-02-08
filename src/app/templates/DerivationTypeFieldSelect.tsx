import React, { FC, ReactNode, useState } from 'react';

import classNames from 'clsx';
import { isEqual } from 'lodash';

import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { InputContainer } from 'app/templates/InputContainer/InputContainer';
import { T, TID } from 'lib/i18n';

type TypeSelectOption<T extends string | number> = {
  type: T;
  name: string;
};

type TypeSelectProps<T extends string | number> = {
  options: TypeSelectOption<T>[];
  value?: T;
  onChange: (value: T) => void;
  i18nKey: ReactNode;
  descriptionI18nKey?: TID;
};

const renderOptionContent = <T extends string | number>(option: TypeSelectOption<T>, isSelected: boolean) => (
  <DerivationOptionContent option={option} isSelected={isSelected} />
);

const DerivationFieldTitle: FC<{ i18nKey: ReactNode; descriptionI18nKey?: TID }> = ({
  i18nKey,
  descriptionI18nKey
}) => (
  <h2 className="leading-tight flex flex-col mb-3">
    <span className="text-base-plus text-white">{i18nKey}</span>
    {descriptionI18nKey && (
      <span className="text-sm text-secondary-white mt-1 block">
        <T id={descriptionI18nKey} />
      </span>
    )}
  </h2>
);

const DerivationFieldContent = <T extends string | number>({ name }: TypeSelectOption<T>) => {
  return (
    <div className="flex items-center">
      <span className="text-base-plus text-white">{name}</span>
    </div>
  );
};

interface LedgerOptionContentProps<T extends string | number> {
  option: TypeSelectOption<T>;
  isSelected?: boolean;
}

const DerivationOptionContent = <T extends string | number>({ option, isSelected }: LedgerOptionContentProps<T>) => {
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

export const DerivationTypeFieldSelect = <T extends string | number>(props: TypeSelectProps<T>) => {
  const { options, value, onChange, i18nKey, descriptionI18nKey } = props;
  const selectedDerivationOption = options.find(op => op.type === value) ?? options[0];

  const [searchValue, setSearchValue] = useState<string>('');

  return (
    <div className="mb-4">
      <InputContainer header={<DerivationFieldTitle i18nKey={i18nKey} descriptionI18nKey={descriptionI18nKey} />}>
        <DropdownSelect
          optionsListClassName="p-2"
          dropdownButtonClassName="px-4 py-14px"
          DropdownFaceContent={<DerivationFieldContent {...selectedDerivationOption} />}
          optionsProps={{
            options,
            noItemsText: 'No items',
            getKey: ({ type }) => {
              return type.toString();
            },
            renderOptionContent: option => renderOptionContent(option, isEqual(option.type, value)),
            onOptionChange: ({ type }) => onChange(type)
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
