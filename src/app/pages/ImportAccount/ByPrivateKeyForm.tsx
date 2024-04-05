import React, { FC, ReactNode, useCallback, useMemo, useState } from 'react';

import classNames from 'clsx';
import { useForm } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useTempleClient } from 'lib/temple/front';
import { clearClipboard } from 'lib/ui/utils';
import { delay } from 'lib/utils';

import { ImportAccountSelectors, ImportAccountFormType } from './selectors';
import { ImportformProps } from './types';

interface ByPrivateKeyFormData {
  privateKey: string;
  encPassword?: string;
}

export const ByPrivateKeyForm: FC<ImportformProps> = ({ className }) => {
  const { popup } = useAppEnv();
  const { importAccount } = useTempleClient();
  const formAnalytics = useFormAnalytics(ImportAccountFormType.PrivateKey);

  const { register, handleSubmit, errors, formState, watch } = useForm<ByPrivateKeyFormData>();
  const [error, setError] = useState<ReactNode>(null);

  const onSubmit = useCallback(
    async ({ privateKey, encPassword }: ByPrivateKeyFormData) => {
      if (formState.isSubmitting) return;

      formAnalytics.trackSubmit();
      setError(null);
      try {
        await importAccount(privateKey.replace(/\s/g, ''), encPassword);

        formAnalytics.trackSubmitSuccess();
      } catch (err: any) {
        formAnalytics.trackSubmitFail();

        console.error(err);

        // Human delay
        await delay();
        setError(err.message);
      }
    },
    [importAccount, formState.isSubmitting, setError, formAnalytics]
  );

  const keyValue = watch('privateKey') ?? '';
  const encrypted = useMemo(() => keyValue?.substring(2, 3) === 'e', [keyValue]);

  return (
    <form
      className={classNames('w-full mx-auto', popup ? 'max-w-sm' : 'max-w-screen-xxs', className)}
      onSubmit={handleSubmit(onSubmit)}
    >
      <div>
        {error && <Alert type="error" title={t('error')} autoFocus description={error} className="mb-4" />}

        <FormField
          ref={register({ required: t('required') })}
          type="password"
          revealForbidden
          name="privateKey"
          id="importacc-privatekey"
          label={t('privateKey')}
          labelDescription={t('privateKeyInputDescription')}
          textarea
          rows={2}
          placeholder={t('enterSecretKey')}
          errorCaption={errors.privateKey?.message}
          className="resize-none"
          containerClassName="mb-6"
          onPaste={clearClipboard}
          testID={ImportAccountSelectors.privateKeyInput}
        />

        {encrypted && (
          <FormField
            ref={register}
            name="encPassword"
            type="password"
            id="importacc-password"
            label={
              <>
                <T id="password" />{' '}
                <span className="text-sm font-light text-gray-600">
                  <T id="optionalComment" />
                </span>
              </>
            }
            labelDescription={t('isPrivateKeyEncrypted')}
            placeholder="*********"
            errorCaption={errors.encPassword?.message}
            containerClassName="mb-6 flex-grow"
          />
        )}
      </div>

      <div>
        <FormSubmitButton
          className="capitalize"
          disabled={!keyValue.length}
          loading={formState.isSubmitting}
          testID={ImportAccountSelectors.privateKeyImportButton}
        >
          {t('importAccount')}
        </FormSubmitButton>
        <div className="h-8" />
      </div>
    </form>
  );
};
