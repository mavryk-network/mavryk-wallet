import React, { FC, ReactNode, useCallback, useState } from 'react';

import classNames from 'clsx';
import { useForm } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import { formatMnemonic } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { isSeedPhraseFilled, SeedPhraseInput } from 'app/templates/SeedPhraseInput';
import { useFormAnalytics } from 'lib/analytics';
import { t } from 'lib/i18n';
import { useTempleClient } from 'lib/temple/front';
import { delay } from 'lib/utils';

import { defaultNumberOfWords } from './constants';
import { ImportAccountSelectors, ImportAccountFormType } from './selectors';
import { ImportformProps } from './types';

interface ByFundraiserFormData {
  email: string;
  password: string;
  mnemonic: string;
}

export const ByFundraiserForm: FC<ImportformProps> = ({ className }) => {
  const { importFundraiserAccount } = useTempleClient();
  const { register, errors, handleSubmit, formState, watch } = useForm<ByFundraiserFormData>();
  const [error, setError] = useState<ReactNode>(null);
  const formAnalytics = useFormAnalytics(ImportAccountFormType.Fundraiser);
  const { popup } = useAppEnv();

  const [seedPhrase, setSeedPhrase] = useState('');
  const [seedError, setSeedError] = useState('');

  const [numberOfWords, setNumberOfWords] = useState(defaultNumberOfWords);

  const onSubmit = useCallback<(data: ByFundraiserFormData) => void>(
    async data => {
      if (formState.isSubmitting) return;

      if (!seedError && isSeedPhraseFilled(seedPhrase)) {
        formAnalytics.trackSubmit();
        setError(null);
        try {
          await importFundraiserAccount(data.email, data.password, formatMnemonic(seedPhrase));

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
    [seedPhrase, importFundraiserAccount, formState.isSubmitting, setError, seedError, formAnalytics, numberOfWords]
  );

  const resetSeedPhrase = useCallback(() => void setSeedPhrase(''), []);

  const emailKey = watch('email') ?? '';
  const passowrdKey = watch('password') ?? '';

  const isBtnDisabled = !emailKey.length || !passowrdKey.length || !seedPhrase.length;

  return (
    <form
      className={classNames('w-full  mx-auto', popup ? 'max-w-sm' : 'max-w-screen-xxs', className)}
      onSubmit={handleSubmit(onSubmit)}
    >
      {error && <Alert type="error" title={t('error')} description={error} autoFocus className="mb-6" />}

      <FormField
        ref={register({ required: t('required') })}
        name="email"
        id="importfundacc-email"
        label={t('email')}
        placeholder={t('enterEmailPlaceholder')}
        errorCaption={errors.email?.message}
        containerClassName="mb-4"
        testID={ImportAccountSelectors.fundraiserEmailInput}
      />

      <FormField
        ref={register({ required: t('required') })}
        name="password"
        type="password"
        id="importfundacc-password"
        label={t('password')}
        placeholder={t('enterPasswordPlaceholder')}
        errorCaption={errors.password?.message}
        testID={ImportAccountSelectors.fundraiserPasswordInput}
      />

      <div className="border-b border-divider my-4" />

      <SeedPhraseInput
        labelWarning={t('mnemonicInputWarning')}
        submitted={formState.submitCount !== 0}
        seedError={seedError}
        setSeedError={setSeedError}
        onChange={setSeedPhrase}
        reset={resetSeedPhrase}
        numberOfWords={numberOfWords}
        setNumberOfWords={setNumberOfWords}
        testID={ImportAccountSelectors.fundraiserSeedPhraseInput}
      />

      <div>
        <FormSubmitButton
          className="capitalize mt-6"
          disabled={isBtnDisabled}
          loading={formState.isSubmitting}
          testID={ImportAccountSelectors.fundraiserImportButton}
        >
          {t('importAccount')}
        </FormSubmitButton>
        <div className="h-8" />
      </div>
    </form>
  );
};
