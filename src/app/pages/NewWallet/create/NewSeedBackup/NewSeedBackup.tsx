import React, { FC } from 'react';

import { useForm } from 'react-hook-form';

import { Alert, FormSubmitButton, FormCheckbox } from 'app/atoms';
import { ReadOnlySecretField } from 'app/atoms/ReadOnlySecretField';
import { T, t } from 'lib/i18n';

import { NewSeedBackupSelectors } from './NewSeedBackup.selectors';

interface BackupFormData {
  backuped: boolean;
}

interface NewSeedBackupProps {
  seedPhrase: string;
  onBackupComplete: () => void;
}

export const NewSeedBackup: FC<NewSeedBackupProps> = ({ seedPhrase, onBackupComplete }) => {
  const { register, handleSubmit, errors, formState, watch } = useForm<BackupFormData>();
  const submitting = formState.isSubmitting;

  const backuped = watch('backuped') ?? false;

  return (
    <div className="w-full mt-6">
      <Alert
        title={`${t('attention')}!`}
        description={
          <>
            <p>
              <T id="revealNewSeedPhrase" />
            </p>

            <p className="mt-1">
              <T id="doNotSharePhrase" />
            </p>
          </>
        }
        className="mt-4 mb-8 pr-6"
      />

      <ReadOnlySecretField
        value={seedPhrase}
        label={'mnemonicInputLabel'}
        testID={NewSeedBackupSelectors.seedPhraseValue}
        secretCoverTestId={NewSeedBackupSelectors.protectedMask}
      />

      <form className="w-full mt-4" onSubmit={handleSubmit(onBackupComplete)}>
        <FormCheckbox
          ref={register({
            validate: val => val || t('unableToContinueWithoutConfirming')
          })}
          errorCaption={errors.backuped?.message}
          name="backuped"
          label={t('backupedInputLabel')}
          testID={NewSeedBackupSelectors.iMadeSeedPhraseBackupCheckBox}
          labelClassName="py-0"
        />

        <FormSubmitButton
          disabled={!backuped}
          loading={submitting}
          className="w-full mt-8"
          testID={NewSeedBackupSelectors.nextButton}
        >
          <T id="next" />
        </FormSubmitButton>
      </form>
    </div>
  );
};
