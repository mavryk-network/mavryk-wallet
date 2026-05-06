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
import { useChainId, useTempleClient, validateDerivationPath } from 'lib/temple/front';
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
  derivationPath: 'default' | 'custom';
  password?: string;
  customDerivationPath: string;
  accountNumber?: number;
}

export const ByMnemonicForm: FC<ImportformProps> = ({ className }) => {
  const { popup } = useAppEnv();
  const { createOrImportWallet, importMnemonicAccount } = useTempleClient();
  const chainId = useChainId();
  const formAnalytics = useFormAnalytics(ImportAccountFormType.Mnemonic);

  const [seedPhrase, setSeedPhrase] = useState('');
  const [seedError, setSeedError] = useState('');

  const [numberOfWords, setNumberOfWords] = useState(defaultNumberOfWords);

  const { register, handleSubmit, errors, formState, reset, control, watch } = useForm<ByMnemonicFormData>({
    defaultValues: {
      derivationPath: DERIVATION_PATHS[0].type,
      customDerivationPath: DEFAULT_DERIVATION_PATH,
      accountNumber: 1
    }
  });

  const [error, setError] = useState<ReactNode>(null);

  const derivationPathType = watch('derivationPath');

  const onSubmit = useCallback(
    async ({ password, customDerivationPath, derivationPath: derivationPathType }: ByMnemonicFormData) => {
      if (formState.isSubmitting) return;

      if (!seedError && isSeedPhraseFilled(seedPhrase)) {
        formAnalytics.trackSubmit();
        setError(null);

        try {
          await createOrImportWallet(formatMnemonic(seedPhrase));

          if (derivationPathType === 'custom') {
            if (!chainId) {
              throw new Error('Chain ID is not available');
            }

            await importMnemonicAccount(formatMnemonic(seedPhrase), chainId, password, customDerivationPath);
          }

          formAnalytics.trackSubmitSuccess();
        } catch (err: any) {
          formAnalytics.trackSubmitFail();

          console.error(err);

          // Human delay
          await delay();
          setError(err.message);
        }
      } else if (seedError === '') {
        setSeedError(String(t('mnemonicWordsAmountConstraint', [numberOfWords])));
      }
    },
    [
      formState.isSubmitting,
      seedError,
      seedPhrase,
      formAnalytics,
      createOrImportWallet,
      importMnemonicAccount,
      chainId,
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
            name="derivationPath"
            options={DERIVATION_PATHS}
            i18nKey={`${t('derivationPath')} ${t('optionalComment')}`}
            descriptionI18nKey="addDerivationPathPrompt"
          />
        </div>
      </div>

      {derivationPathType === 'custom' && (
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
