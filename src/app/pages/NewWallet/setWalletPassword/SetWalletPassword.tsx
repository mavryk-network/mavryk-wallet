import React, { FC, useState } from 'react';

import classNames from 'clsx';

import { FormField, FormSubmitButton, PASSWORD_ERROR_CAPTION } from 'app/atoms';
import { PASSWORD_PATTERN } from 'app/defaults';
import { useAppEnv } from 'app/env';
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
  const { fullPage } = useAppEnv();
  const [focused, setFocused] = useState(false);
  const {
    control,
    handleSubmit,
    onSubmit,
    register,
    submitting,
    errors,
    isImportFromKeystoreFile,
    shouldUseKeystorePassword,
    handlePasswordChange,
    passwordValidation,
    isPasswordError,
    passwordValue,
    disabled
  } = useCreareOrRestorePassword(ownMnemonic, seedPhrase, keystorePassword);

  console.log(fullPage);

  return (
    <form
      className={classNames('w-full mx-auto flex flex-col no-scrollbar', !fullPage && 'pt-4 pb-8')}
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
            labelDescription={fullPage ? undefined : t('unlockPasswordInputDescription')}
            labelClassname={classNames(fullPage && 'mb-2')}
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
            labelDescription={fullPage ? undefined : t('repeatPasswordInputDescription')}
            labelClassname={classNames(fullPage && 'mb-2')}
            fieldWrapperBottomMargin={!fullPage}
            id="newwallet-repassword"
            type="password"
            name="repeatPassword"
            placeholder={t('confirmWalletPassword')}
            errorCaption={errors.repeatPassword?.message}
            containerClassName={classNames(fullPage ? 'mt-2 mb-6' : 'mt-6 mb-1')}
            testID={setWalletPasswordSelectors.repeatPasswordField}
          />
        </>
      )}

      <ImportPartialFormCheckboxes control={control} errors={errors} register={register} />

      <FormSubmitButton
        loading={submitting}
        disabled={disabled}
        className={classNames('w-full', fullPage ? 'mt-8' : 'mt-13')}
        testID={ownMnemonic ? setWalletPasswordSelectors.restoreButton : setWalletPasswordSelectors.createButton}
      >
        <T id={ownMnemonic ? 'restore' : 'import'} />
      </FormSubmitButton>
    </form>
  );
};
