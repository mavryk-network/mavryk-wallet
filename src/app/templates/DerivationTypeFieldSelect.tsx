import React, { FC, ReactNode } from 'react';

import classNames from 'clsx';

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
  <div className="mb-3 flex flex-col leading-tight">
    <span className="text-base-plus text-white">{i18nKey}</span>
    {descriptionI18nKey && (
      <span className="text-sm text-secondary-white mt-1 block">
        <T id={descriptionI18nKey} />
      </span>
    )}
  </div>
);

const DerivationFieldContent = <T extends string | number>({ name }: TypeSelectOption<T>) => {
  return (
    <section className="flex items-center justify-between w-full text-base-plus text-white">
      <span>{name}</span>
    </section>
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
        'p-4 flex items-center justify-between w-full',
        isSelected ? 'bg-gray-710' : 'bg-primary-card hover:bg-gray-710'
      )}
    >
      <div className="text-base-plus text-white text-left">{option.name}</div>
    </div>
  );
};

export const DerivationTypeFieldSelect = <T extends string | number>(props: TypeSelectProps<T>) => {
  const { options, value, onChange, i18nKey, descriptionI18nKey } = props;
  const selectedDerivationOption = options.find(op => op.type === value) ?? options[0];

  return (
    <div className="mb-4">
      <InputContainer header={<DerivationFieldTitle i18nKey={i18nKey} descriptionI18nKey={descriptionI18nKey} />}>
        <DropdownSelect
          optionsListClassName="p-0"
          dropdownButtonClassName="px-4 py-14px"
          dropdownWrapperClassName="border-none rounded-2xl-plus"
          DropdownFaceContent={<DerivationFieldContent {...selectedDerivationOption} />}
          optionsProps={{
            options,
            noItemsText: 'No items',
            getKey: ({ type }) => {
              return type.toString();
            },
            renderOptionContent: option => renderOptionContent(option, option.type === value),
            onOptionChange: ({ type }) => onChange(type)
          }}
        />
      </InputContainer>
    </div>
  );
};
