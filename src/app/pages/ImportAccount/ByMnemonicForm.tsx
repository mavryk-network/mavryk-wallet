import React, { FC, ReactNode, useCallback, useState } from 'react';

import clsx from 'clsx';
import { Controller, useForm } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import { DEFAULT_DERIVATION_PATH, formatMnemonic } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { DerivationTypeFieldSelect } from 'app/templates/DerivationTypeFieldSelect';
import { isSeedPhraseFilled, SeedPhraseInput } from 'app/templates/SeedPhraseInput';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useTempleClient, validateDerivationPath } from 'lib/temple/front';
import { delay } from 'lib/utils';

import { defaultNumberOfWords } from './constants';
import { ImportAccountSelectors, ImportAccountFormType } from './selectors';
import { ImportformProps } from './types';

const DERIVATION_PATHS = [
  {
    type: 'default',
    name: t('defaultAccount')
  },
  {
    type: 'custom',
    name: t('customDerivationPath')
  }
];

interface ByMnemonicFormData {
  password?: string;
  customDerivationPath: string;
  accountNumber?: number;
}

export const ByMnemonicForm: FC<ImportformProps> = ({ className }) => {
  const { popup } = useAppEnv();
  const { importMnemonicAccount } = useTempleClient();
  const formAnalytics = useFormAnalytics(ImportAccountFormType.Mnemonic);

  const [seedPhrase, setSeedPhrase] = useState('');
  const [seedError, setSeedError] = useState('');

  const [numberOfWords, setNumberOfWords] = useState(defaultNumberOfWords);

  const { register, handleSubmit, errors, formState, reset, control, watch } = useForm<ByMnemonicFormData>({
    defaultValues: {
      customDerivationPath: DEFAULT_DERIVATION_PATH,
      accountNumber: 1
    }
  });
  const [error, setError] = useState<ReactNode>(null);

  const derivationPath = watch('customDerivationPath');

  const onSubmit = useCallback(
    async ({ password, customDerivationPath }: ByMnemonicFormData) => {
      if (formState.isSubmitting) return;

      if (!seedError && isSeedPhraseFilled(seedPhrase)) {
        formAnalytics.trackSubmit();
        setError(null);

        try {
          await importMnemonicAccount(
            formatMnemonic(seedPhrase),
            password || undefined,
            derivationPath === 'custom' ? customDerivationPath || undefined : DEFAULT_DERIVATION_PATH
          );

          formAnalytics.trackSubmitSuccess();
        } catch (err: any) {
          formAnalytics.trackSubmitFail();

          console.error(err);

          // Human delay
          await delay();
          setError(err.message);
        }
      } else if (seedError === '') {
        setSeedError(t('mnemonicWordsAmountConstraint', [numberOfWords]) as string);
      }
    },
    [
      seedPhrase,
      seedError,
      formState.isSubmitting,
      setError,
      importMnemonicAccount,
      derivationPath,
      formAnalytics,
      numberOfWords
    ]
  );

  return (
    <form
      className={clsx('w-full mx-auto', popup ? 'max-w-sm' : 'max-w-screen-xxs', className)}
      onSubmit={handleSubmit(onSubmit)}
    >
      {error && <Alert type="error" title={t('error')} autoFocus description={error} className="mb-6" />}

      <div>
        <SeedPhraseInput
          labelWarning={`${t('mnemonicInputWarning')}\n${t('seedPhraseAttention')}`}
          submitted={formState.submitCount !== 0}
          seedError={seedError}
          setSeedError={setSeedError}
          onChange={setSeedPhrase}
          reset={reset}
          testID={ImportAccountSelectors.mnemonicWordInput}
          numberOfWords={numberOfWords}
          setNumberOfWords={setNumberOfWords}
        />
      </div>

      <div className="border-b border-divider w-full my-4" />

      <div className="flex flex-col">
        <div>
          <Controller
            as={DerivationTypeFieldSelect}
            control={control}
            name="customDerivationPath"
            options={DERIVATION_PATHS}
            i18nKey={`${t('derivationPath')} ${t('optionalComment')}`}
            descriptionI18nKey="addDerivationPathPrompt"
          />
        </div>
      </div>

      {derivationPath === 'custom' && (
        <FormField
          ref={register({
            validate: validateDerivationPath
          })}
          name="customDerivationPath"
          id="importacc-cdp"
          label={t('customDerivationPath')}
          placeholder={t('derivationPathExample2')}
          errorCaption={errors.customDerivationPath?.message}
          containerClassName="mb-3"
          testID={ImportAccountSelectors.customDerivationPathInput}
        />
      )}

      <FormField
        ref={register}
        name="password"
        type="password"
        id="importfundacc-password"
        label={
          <>
            <T id="password" />{' '}
            <span className="text-base-plus text-white">
              <T id="optionalComment" />
            </span>
          </>
        }
        labelDescription={t('passwordInputDescription')}
        placeholder={t('createPasswordPlaceholder')}
        errorCaption={errors.password?.message}
        testID={ImportAccountSelectors.mnemonicPasswordInput}
      />
      <div>
        <FormSubmitButton
          loading={formState.isSubmitting}
          disabled={!seedPhrase.length}
          className="mt-6 capitalize"
          testID={ImportAccountSelectors.mnemonicImportButton}
        >
          <T id="importAccount" />
        </FormSubmitButton>
        <div className="h-8" />
      </div>
    </form>
  );
};
