import React, { useCallback, FC, useState, useMemo } from 'react';

import classNames from 'clsx';

import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { InputContainer } from 'app/templates/InputContainer/InputContainer';
import { AnalyticsEventCategory, AnalyticsEventEnum, setTestID, useAnalytics } from 'lib/analytics';
import { FIAT_CURRENCIES, FiatCurrencyOption, useFiatCurrency } from 'lib/fiat-currency';
import { T } from 'lib/i18n';
import { searchAndFilterItems } from 'lib/utils/search-items';

import { SettingsGeneralSelectors } from '../selectors';

const renderOptionContent = (option: FiatCurrencyOption, isSelected: boolean) => (
  <FiatCurrencyOptionContent option={option} isSelected={isSelected} />
);

const FiatCurrencySelect: FC = () => {
  const { trackEvent } = useAnalytics();
  const { selectedFiatCurrency, setSelectedFiatCurrency } = useFiatCurrency();

  const value = selectedFiatCurrency;

  const [searchValue, setSearchValue] = useState<string>('');

  const options = useMemo<Array<FiatCurrencyOption>>(
    () =>
      searchAndFilterItems(
        FIAT_CURRENCIES,
        searchValue,
        [
          { name: 'name', weight: 1 },
          { name: 'fullname', weight: 0.75 }
        ],
        null,
        0.25
      ),
    [searchValue]
  );

  const handleFiatCurrencyChange = useCallback(
    (fiatOption: FiatCurrencyOption) => {
      trackEvent(AnalyticsEventEnum.FiatCurrencyChanged, AnalyticsEventCategory.ButtonPress, {
        name: fiatOption.name
      });
      setSelectedFiatCurrency(fiatOption);
    },
    [setSelectedFiatCurrency, trackEvent]
  );

  return (
    <InputContainer className="mb-4" header={<FiatCurrencyTitle />}>
      <DropdownSelect
        optionsListClassName="p-2"
        dropdownButtonClassName="px-4 py-14px"
        DropdownFaceContent={<FiatCurrencyFieldContent option={value} />}
        optionsProps={{
          options,
          noItemsText: 'No items',
          getKey: option => option.fullname,
          renderOptionContent: option => renderOptionContent(option, option.fullname === selectedFiatCurrency.fullname),
          onOptionChange: handleFiatCurrencyChange
        }}
        searchProps={{
          searchValue,
          onSearchChange: event => setSearchValue(event.target.value)
        }}
      />
    </InputContainer>
  );
};

export default FiatCurrencySelect;

const FiatCurrencyTitle: FC = () => (
  <h2 className="leading-tight flex flex-col mb-3">
    <span className="text-base-plus text-white">
      <T id="fiatCurrency" />
    </span>
  </h2>
);

interface FiatCurrencyOptionContentProps {
  option: FiatCurrencyOption;
  isSelected?: boolean;
}

const FiatCurrencyIcon: FC<FiatCurrencyOptionContentProps> = ({ option: { symbol } }) => {
  return (
    <div
      className="w-auto flex justify-center items-center text-base-plus text-current"
      style={{ height: '1.3125rem' }}
    >
      {symbol}
    </div>
  );
};

const FiatCurrencyFieldContent: FC<FiatCurrencyOptionContentProps> = ({ option }) => {
  return (
    <div className="flex items-center text-white text-base-plus">
      <span>{option.name} (</span>
      <FiatCurrencyIcon option={option} />
      <span>)&nbsp;-&nbsp;</span>
      <span>{option.fullname}</span>
    </div>
  );
};

const FiatCurrencyOptionContent: FC<FiatCurrencyOptionContentProps> = ({ option, isSelected }) => {
  return (
    <div
      className={classNames(
        'w-full flex items-center py-3 px-2 rounded hover:text-white',
        isSelected ? 'bg-primary-card' : 'hover:bg-primary-card',
        isSelected ? 'text-white' : 'text-secondary-white'
      )}
    >
      <FiatCurrencyIcon option={option} />

      <div
        className={classNames('w-full text-left text-base-plus ml-2')}
        {...setTestID(SettingsGeneralSelectors.currencyItem)}
      >
        {option.name} ({option.fullname})
      </div>
    </div>
  );
};
