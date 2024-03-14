import React, { FC, memo, useCallback } from 'react';

import { emptyFn } from '@rnw-community/shared';
import classNames from 'clsx';

import { ImportAccountSelectors } from 'app/pages/ImportAccount/selectors';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { t } from 'lib/i18n';

interface Props {
  option: string;
  selectedOption: string;
  onClick?: (option: string) => void;
  onChange?: (option: string) => void;
}

export const SeedLengthOption: FC<Props> = memo(({ option, selectedOption, onClick = emptyFn, onChange = emptyFn }) => {
  const handleClick = useCallback(() => onClick(option), [onClick, option]);

  return (
    <li
      value={option}
      onClick={handleClick}
      className={classNames(
        selectedOption === option ? 'bg-primary-card-hover' : 'hover:bg-primary-card-hover',
        'p-4 bg-primary-card',
        'text-white',
        'flex justify-start'
      )}
    >
      <label
        htmlFor={option}
        className="flex gap-2 items-center"
        {...setTestID(ImportAccountSelectors.mnemonicWordsRadioButton)}
        {...setAnotherSelector('words', option)}
      >
        <span className="text-base-plus">{option.concat(t('words'))}</span>
      </label>
    </li>
  );
});
