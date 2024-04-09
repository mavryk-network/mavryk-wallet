import React, { useMemo, useCallback, FC, useState } from 'react';

import classNames from 'clsx';
import browser from 'webextension-polyfill';

import Flag from 'app/atoms/Flag';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { InputContainer } from 'app/templates/InputContainer/InputContainer';
import { AnalyticsEventCategory, AnalyticsEventEnum, setTestID, useAnalytics } from 'lib/analytics';
import { getCurrentLocale, updateLocale, T } from 'lib/i18n';
import { searchAndFilterItems } from 'lib/utils/search-items';

import { SettingsGeneralSelectors } from '../selectors';

type LocaleOption = {
  code: string;
  disabled: boolean;
  flagName: string;
  label: string;
};

const LOCALE_OPTIONS: LocaleOption[] = [
  {
    code: 'en',
    flagName: 'us',
    label: 'English',
    disabled: false
  },
  {
    code: 'en_GB',
    flagName: 'gb',
    label: 'English ‒ United Kingdom',
    disabled: false
  },
  {
    code: 'fr',
    flagName: 'fr',
    label: 'French (Français)',
    disabled: true
  },
  {
    code: 'de',
    flagName: 'de',
    label: 'German (Deutsch)',
    disabled: true
  },
  {
    code: 'zh_CN',
    flagName: 'cn',
    label: 'Chinese ‒ Simplified (简体中文)',
    disabled: true
  },
  {
    code: 'zh_TW',
    flagName: 'tw',
    label: 'Chinese ‒ Traditional (繁體中文)',
    disabled: true
  },
  {
    code: 'ja',
    flagName: 'jp',
    label: 'Japanese (日本語)',
    disabled: true
  },
  {
    code: 'ko',
    flagName: 'kr',
    label: 'Korean',
    disabled: true
  },
  {
    code: 'uk',
    flagName: 'ua',
    label: 'Ukrainian (Українська)',
    disabled: true
  },
  {
    code: 'tr',
    flagName: 'tr',
    label: 'Turkish (Türk)',
    disabled: true
  },
  {
    code: 'pt',
    flagName: 'pt',
    label: 'Portuguese (Português)',
    disabled: true
  },
  // Disabled
  {
    code: 'ru',
    flagName: 'ru',
    label: 'Russian (Русский)',
    disabled: true
  }
];

const selectedLocale = 'en';

const LocaleSelect: FC = () => {
  // const selectedLocale = getCurrentLocale();
  const { trackEvent } = useAnalytics();
  const [searchValue, setSearchValue] = useState<string>('');

  const options = useMemo(
    () =>
      searchAndFilterItems(LOCALE_OPTIONS, searchValue, [
        { name: 'code', weight: 0.75 },
        { name: 'flagName', weight: 1 },
        { name: 'label', weight: 0.5 }
      ]),
    [searchValue]
  );

  const value = useMemo(
    () => options.find(({ code }) => code === selectedLocale) ?? LOCALE_OPTIONS[0],
    [selectedLocale]
  );

  const handleLocaleChange = useCallback(
    ({ code }: LocaleOption) => {
      trackEvent(AnalyticsEventEnum.LanguageChanged, AnalyticsEventCategory.ButtonPress, { code });
      // TODO add code later
      updateLocale('en');
    },
    [trackEvent]
  );

  return (
    <InputContainer className="mb-4" header={<LocaleTitle />}>
      <DropdownSelect
        optionsListClassName="p-2"
        dropdownButtonClassName="px-4 py-14px"
        DropdownFaceContent={<LocaleFieldContent {...value} />}
        optionsProps={{
          options,
          noItemsText: 'No items',
          getKey: option => option.code,
          renderOptionContent: option => renderOptionContent(option, option.code === value.code),
          onOptionChange: handleLocaleChange
        }}
        searchProps={{
          searchValue,
          onSearchChange: event => setSearchValue(event?.target.value)
        }}
      />
    </InputContainer>
  );
};

export default LocaleSelect;

const LocaleTitle: FC = () => (
  <h2 className="leading-tight flex flex-col mb-3">
    <span className="text-base-plus text-white">
      <T id="languageAndCountry" />
    </span>
  </h2>
);

interface LocaleOptionContentProps {
  option: LocaleOption;
  isSelected?: boolean;
}

const LocaleIcon: FC<LocaleOptionContentProps> = ({ option: { flagName, code } }) => (
  <Flag alt={code} className="ml-2 mr-3" src={browser.runtime.getURL(`/misc/country-flags/${flagName}.svg`)} />
);

const LocaleFieldContent = (option: LocaleOption) => (
  <div className="flex items-center">
    <span className="text-base-plus text-white">{option.label}</span>
    <LocaleIcon option={option} />
  </div>
);

const LocaleOptionContent: FC<LocaleOptionContentProps> = ({ option, isSelected }) => {
  return (
    <div
      className={classNames(
        'flex items-center py-3 px-2 rounded hover:text-white',
        isSelected ? 'bg-primary-card' : 'hover:bg-primary-card ',
        isSelected ? 'text-white' : 'text-secondary-white',
        option.disabled && 'opacity-25 cursor-default'
      )}
      {...setTestID(SettingsGeneralSelectors.languageitem)}
    >
      <LocaleIcon option={option} />

      <div className={classNames('relative text-left w-full text-base-plus')}>
        {option.label}

        {option.disabled && (
          <div className="absolute top-0 bottom-0 right-0 flex items-center">
            <div className="mr-2 px-1 bg-accent-blue rounded-sm shadow-md text-white text-xs font-semibold uppercase">
              <T id="soon" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const renderOptionContent = (option: LocaleOption, isSelected: boolean) => (
  <LocaleOptionContent option={option} isSelected={isSelected} />
);
