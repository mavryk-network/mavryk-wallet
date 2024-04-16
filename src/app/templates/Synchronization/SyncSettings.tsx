import React, { FC, useCallback, useLayoutEffect, useRef } from 'react';

import clsx from 'clsx';
import { OnSubmit, useForm } from 'react-hook-form';
import { QRCode } from 'react-qr-svg';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { T, t } from 'lib/i18n';
import { useTempleClient } from 'lib/temple/front';
import { useVanishingState } from 'lib/ui/hooks';
import { delay } from 'lib/utils';
import { navigate } from 'lib/woozie';

import { SyncSettingsSelectors } from './SyncSettings.selectors';

type FormData = {
  password: string;
};

const SyncSettings: FC = () => {
  const { generateSyncPayload } = useTempleClient();
  const { popup } = useAppEnv();

  const formRef = useRef<HTMLFormElement>(null);
  const [payload, setPayload] = useVanishingState();
  const { register, handleSubmit, errors, setError, clearError, formState, watch } = useForm<FormData>();

  const focusPasswordField = useCallback(
    () => formRef.current?.querySelector<HTMLInputElement>("input[name='password']")?.focus(),
    []
  );

  useLayoutEffect(() => focusPasswordField(), [focusPasswordField]);

  const onSubmit = useCallback<OnSubmit<FormData>>(
    async ({ password }) => {
      if (formState.isSubmitting) return;

      clearError('password');
      try {
        const syncPayload = await generateSyncPayload(password);
        setPayload(syncPayload);
      } catch (err: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error(err);
        }

        // Human delay.
        await delay();
        setError('password', 'submit-error', err.message);
        focusPasswordField();
      }
    },
    [formState.isSubmitting, clearError, setError, generateSyncPayload, setPayload, focusPasswordField]
  );

  const handleQRBttonClick = useCallback(() => {
    setPayload(null);
    navigate('/');
  }, [setPayload]);

  const passwordValue = watch('password');

  const isPasswordEntered = passwordValue?.length ?? 0 > 0;

  return (
    <div className="w-full h-full flex flex-col flex-1">
      {payload ? (
        <>
          <Alert
            title={t('attentionExclamation')}
            description={
              <p>
                <T id="syncSettingsAlert" />
              </p>
            }
            className="mb-7"
          />

          <p className="mb-6 text-sm text-white text-center">
            <T id="scanQRWithTempleMobile" />
          </p>

          <div className="p-6 mb-8 bg-white rounded-2xl self-center">
            <QRCode value={payload} bgColor="#f4f4f4" fgColor="#000000" level="L" style={{ width: 216 }} />
          </div>

          <div className={clsx(popup && 'pb-8')}>
            <FormSubmitButton
              className="w-full justify-center mt-2"
              onClick={handleQRBttonClick}
              testID={SyncSettingsSelectors.doneButton}
            >
              <T id="goToMain" />
            </FormSubmitButton>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-secondary-white">
            <T id="syncSettingsDescription" />
          </p>

          <form
            ref={formRef}
            onSubmit={handleSubmit(onSubmit)}
            className={clsx('flex flex-col flex-grow justify-between', popup && 'pb-8')}
          >
            <FormField
              ref={register({ required: t('required') })}
              label={t('password')}
              // labelDescription={t('syncPasswordDescription')}
              id="reveal-secret-password"
              type="password"
              name="password"
              placeholder={t('enterWalletPassword')}
              errorCaption={errors.password?.message}
              containerClassName="mb-4"
              testID={SyncSettingsSelectors.passwordInput}
            />

            <FormSubmitButton
              disabled={!isPasswordEntered}
              loading={formState.isSubmitting}
              testID={SyncSettingsSelectors.syncButton}
            >
              <T id="sync" />
            </FormSubmitButton>
          </form>
        </>
      )}
    </div>
  );
};

export default SyncSettings;
