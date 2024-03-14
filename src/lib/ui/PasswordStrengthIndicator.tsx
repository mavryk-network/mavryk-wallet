import React, { FC } from 'react';

import { T } from 'lib/i18n';

import PasswordStrengthIndicatorItem from './PasswordStrengthIndicatorItem';

export interface PasswordValidation {
  minChar: boolean;
  cases: boolean;
  number: boolean;
  specialChar: boolean;
}

interface PasswordStrengthIndicatorProps {
  validation: PasswordValidation;
  isPasswordError?: boolean;
}

const PasswordStrengthIndicator: FC<PasswordStrengthIndicatorProps> = ({
  validation: { minChar, cases, number, specialChar },
  isPasswordError = false
}) => (
  <div className={'text-xs font-medium text-secondary-white'}>
    <T id="requirements">
      {message => (
        <PasswordStrengthIndicatorItem
          isValid={minChar && cases && number && specialChar}
          message={message}
          noColor={!isPasswordError}
          title
        />
      )}
    </T>
    <br />
    <ul className="list-disc list-inside flex flex-col gap-1">
      <T id="atLeast8Characters">
        {message => <PasswordStrengthIndicatorItem isValid={minChar} message={message} noColor={!isPasswordError} />}
      </T>
      <T id="mixtureOfUppercaseAndLowercaseLetters">
        {message => <PasswordStrengthIndicatorItem isValid={cases} message={message} noColor={!isPasswordError} />}
      </T>
      <T id="mixtureOfLettersAndNumbers">
        {message => <PasswordStrengthIndicatorItem isValid={number} message={message} noColor={!isPasswordError} />}
      </T>
      <span style={{ maxWidth: 343 }}>
        <T id="atLeast1SpecialCharacter">
          {message => <PasswordStrengthIndicatorItem isValid={specialChar} message={message} noColor />}
        </T>
      </span>
    </ul>
  </div>
);

export default PasswordStrengthIndicator;
