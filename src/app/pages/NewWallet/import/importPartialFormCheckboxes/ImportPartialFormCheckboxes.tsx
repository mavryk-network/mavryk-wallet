import React, { FC } from 'react';

import clsx from 'clsx';
import { Control, Controller, FieldErrors } from 'react-hook-form';

import { FormCheckbox } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { T, t } from 'lib/i18n';

import { setWalletPasswordSelectors } from '../../setWalletPassword/SetWalletPassword.selectors';
import { FormData } from '../useCreareOrRestorePassword';

import styles from './importPartialFromCheckboxes.module.css';

type ImportPartialFormCheckboxesProps = {
  control: Control<FormData>;
  register: (...args: any) => any;
  errors: FieldErrors<FormData>;
};

export const ImportPartialFormCheckboxes: FC<ImportPartialFormCheckboxesProps> = ({ control, register, errors }) => {
  const { popup } = useAppEnv();

  const { ref: betaRef, ...betaRest } = register('betaAgreement', {
    validate: (val: unknown) => val || t('confirmBetaError')
  });
  const { ref: termsRef, ...termsRest } = register('termsAccepted', {
    validate: (val: unknown) => val || t('confirmTermsError')
  });

  return (
    <>
      <Controller
        control={control}
        name="skipOnboarding"
        render={({ field: { value, onChange, ref } }) => (
          <FormCheckbox
            ref={ref}
            checked={Boolean(value)}
            onChange={checked => onChange(checked)}
            label={t('skipOnboarding')}
            testID={setWalletPasswordSelectors.skipOnboardingCheckbox}
          />
        )}
      />
      <Controller
        control={control}
        name="analytics"
        render={({ field: { value, onChange, ref } }) => (
          <FormCheckbox
            ref={ref}
            checked={Boolean(value)}
            onChange={checked => onChange(checked)}
            label={
              <T
                id="analyticsInputDescription"
                substitutions={[
                  <a
                    href="https://docs.google.com/document/d/1CxGYpRhMHoqTZda4O9FoVFfL5iNKpowjsPBRrlWWok0/edit?usp=sharing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-secondary text-accent-blue"
                  >
                    <T id="analyticsCollecting" key="analyticsLink" />
                  </a>
                ]}
              />
            }
            testID={setWalletPasswordSelectors.analyticsCheckBox}
          />
        )}
      />

      {/* <Controller
        control={control}
        name="viewAds"
        as={FormCheckbox}
        label={<T id="viewAdsDescription" />}
        testID={setWalletPasswordSelectors.viewAdsCheckBox}
      /> */}

      <FormCheckbox
        ref={betaRef}
        name={betaRest.name}
        onNativeChange={betaRest.onChange}
        onBlur={betaRest.onBlur}
        errorCaption={errors.betaAgreement?.message}
        testID={setWalletPasswordSelectors.betaAgreementCheckbox}
        label={<T id="betaAgreementMsg" />}
      />

      <FormCheckbox
        ref={termsRef}
        name={termsRest.name}
        onNativeChange={termsRest.onChange}
        onBlur={termsRest.onBlur}
        errorCaption={errors.termsAccepted?.message}
        testID={setWalletPasswordSelectors.acceptTermsCheckbox}
        labelClassName={clsx(popup && styles['max-w-295'])}
        label={
          <T
            id="acceptTermsInputDescription"
            substitutions={[
              <a
                href="https://docs.google.com/document/d/1Qu9Ge-fBg9x3aCAjKgSYGHQgpeOKF5WWqOZVLP-cfyo/edit?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-secondary text-accent-blue"
              >
                <T id="termsOfUsage" key="termsLink" />
              </a>,
              <a
                href="https://docs.google.com/document/d/1Kl6Vo1WpEy8XjwzwbuGvyyDfDwwTc_x7q0WyfLfzJcs/edit?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-secondary text-accent-blue"
              >
                <T id="privacyPolicy" key="privacyPolicyLink" />
              </a>
            ]}
          />
        }
        containerClassName="flex-1"
      />
    </>
  );
};
