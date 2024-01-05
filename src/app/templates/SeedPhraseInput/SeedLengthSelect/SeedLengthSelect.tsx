import React, { FC, useCallback, useEffect, useRef, useState } from 'react';

import classNames from 'clsx';

import { useAppEnv } from 'app/env';
import { ReactComponent as SelectArrowDownIcon } from 'app/icons/chevron-down.svg';
import { ImportAccountSelectors } from 'app/pages/ImportAccount/selectors';
import { setTestID } from 'lib/analytics';
import { t } from 'lib/i18n';

import { SeedLengthOption } from './SeedLengthOption/SeedLengthOption';

interface SeedLengthSelectProps {
  options: Array<string>;
  currentOption: string;
  defaultOption?: string;
  onChange: (newSelectedOption: string) => void;
}

export const SeedLengthSelect: FC<SeedLengthSelectProps> = ({ options, currentOption, defaultOption, onChange }) => {
  const [selectedOption, setSelectedOption] = useState(defaultOption ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const { fullPage } = useAppEnv();

  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedOption !== currentOption) {
      setSelectedOption(currentOption);
    }
  }, [currentOption, selectedOption]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectRef]);

  const handleClick = useCallback(
    (option: string) => {
      setIsOpen(false);
      setSelectedOption(option);
      onChange(option);
    },
    [onChange]
  );

  return (
    <div
      ref={selectRef}
      className={classNames(
        'absolute right-0 z-10 text-white border border-primary-border rounded-md bg-primary-bg cursor-pointer'
      )}
    >
      <div
        style={{ minWidth: 126 }}
        className={classNames('flex flex-row gap-x-3 justify-around items-center px-4 py-3.5 text-white')}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span
          style={{ height: '19px' }}
          {...setTestID(ImportAccountSelectors.mnemonicDropDownButton)}
          className="text-base-plus"
        >
          {fullPage ? t('seedInputNumberOfWords', [`${selectedOption}`]) : t('words', [`${selectedOption}`])}{' '}
        </span>
        <SelectArrowDownIcon
          className={classNames(
            'stroke-white stroke-2',
            'opacity-1 w-4 h-4 transition ease-in-out duration-75',
            isOpen && 'transform rotate-180'
          )}
        />
      </div>
      <ul className={classNames(!isOpen && 'hidden')}>
        {options.map(option => {
          return (
            <SeedLengthOption
              key={option}
              option={option}
              selectedOption={selectedOption}
              onClick={handleClick}
              onChange={setSelectedOption}
            />
          );
        })}
      </ul>
    </div>
  );
};
