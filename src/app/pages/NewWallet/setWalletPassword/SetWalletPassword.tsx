import React, { FC, useState } from 'react';

import classNames from 'clsx';

import { FormField, FormSubmitButton, PASSWORD_ERROR_CAPTION } from 'app/atoms';
import { PASSWORD_PATTERN } from 'app/defaults';
import { T, t } from 'lib/i18n';
import PasswordStrengthIndicator from 'lib/ui/PasswordStrengthIndicator';

import { ImportPartialFormCheckboxes } from '../import/importPartialFormCheckboxes/ImportPartialFormCheckboxes';
import { useCreareOrRestorePassword } from '../import/useCreareOrRestorePassword';
import { setWalletPasswordSelectors } from './SetWalletPassword.selectors';

interface SetWalletPasswordProps {
  ownMnemonic?: boolean;
  seedPhrase: string;
  keystorePassword?: string;
  testID?: string;
}

export const SetWalletPassword: FC<SetWalletPasswordProps> = ({
  ownMnemonic = false,
  seedPhrase,
  keystorePassword
}) => {
  const [focused, setFocused] = useState(false);
  const {
    control,
    handleSubmit,
    onSubmit,
    register,
    submitting,
    errors,
    isImportFromKeystoreFile,
    // isKeystorePasswordWeak,
    // setPasswordValidation,
    shouldUseKeystorePassword,
    handlePasswordChange,
    passwordValidation,
    isPasswordError,
    passwordValue
  } = useCreareOrRestorePassword(ownMnemonic, seedPhrase, keystorePassword);

  return (
    <form
      className={classNames('w-full h-full max-w-sm mx-auto flex flex-col pt-4 pb-8 no-scrollbar')}
      onSubmit={handleSubmit(onSubmit)}
    >
      {(!shouldUseKeystorePassword || !isImportFromKeystoreFile) && (
        <>
          <FormField
            ref={register({
              required: PASSWORD_ERROR_CAPTION,
              pattern: {
                value: PASSWORD_PATTERN,
                message: PASSWORD_ERROR_CAPTION
              }
            })}
            label={t('password')}
            labelDescription={t('unlockPasswordInputDescription')}
            id="newwallet-password"
            type="password"
            name="password"
            placeholder={t('createWalletPassword')}
            errorCaption={errors.password?.message}
            onFocus={() => setFocused(true)}
            onChange={handlePasswordChange}
            testID={setWalletPasswordSelectors.passwordField}
          />

          {passwordValidation && (
            <>
              {isPasswordError && (
                <PasswordStrengthIndicator validation={passwordValidation} isPasswordError={isPasswordError} />
              )}
              {!isPasswordError && focused && (
                <PasswordStrengthIndicator validation={passwordValidation} isPasswordError={isPasswordError} />
              )}
            </>
          )}

          <FormField
            ref={register({
              required: t('required'),
              validate: val => val === passwordValue || t('mustBeEqualToPasswordAbove')
            })}
            label={t('confirmPassword')}
            labelDescription={t('repeatPasswordInputDescription')}
            id="newwallet-repassword"
            type="password"
            name="repeatPassword"
            placeholder={t('confirmWalletPassword')}
            errorCaption={errors.repeatPassword?.message}
            containerClassName="mt-6 mb-1"
            testID={setWalletPasswordSelectors.repeatPasswordField}
          />
        </>
      )}

      <ImportPartialFormCheckboxes control={control} errors={errors} register={register} />

      <FormSubmitButton
        loading={submitting}
        className="w-full mt-8"
        testID={ownMnemonic ? setWalletPasswordSelectors.restoreButton : setWalletPasswordSelectors.createButton}
      >
        <T id={ownMnemonic ? 'restore' : 'create'} />
      </FormSubmitButton>
    </form>
  );
};
