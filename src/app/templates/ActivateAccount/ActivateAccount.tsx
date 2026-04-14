import React, { memo, KeyboardEventHandler, ReactNode, useCallback, useMemo } from 'react';

import clsx from 'clsx';
import { useForm } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import { useAppEnv } from 'app/env';
import AccountBanner from 'app/templates/AccountBanner';
import { T, t } from 'lib/i18n';
import { useTezos, useAccount, activateAccount } from 'lib/temple/front';
import { SUBMIT_ERROR_TYPE } from 'lib/utils/get-error-message';
import { confirmOperation } from 'lib/temple/operation';
import { useSafeState } from 'lib/ui/hooks';

import { ActivateAccountSelectors } from './ActivateAccount.selectors';

type FormData = {
  secret: string;
};

const ActivateAccount = memo(() => {
  const tezos = useTezos();
  const account = useAccount();
  const { popup } = useAppEnv();

  const [success, setSuccess] = useSafeState<ReactNode>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: submitting },
    clearErrors,
    setError,
    watch
  } = useForm<FormData>();
  const secret = watch('secret') ?? '';

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (submitting) return;

      clearErrors('secret');
      setSuccess(null);

      try {
        const activation = await activateAccount(account.publicKeyHash, data.secret.replace(/\s/g, ''), tezos);
        switch (activation.status) {
          case 'ALREADY_ACTIVATED':
            setSuccess(`🏁 ${t('accountAlreadyActivated')}`);
            break;

          case 'SENT':
            setSuccess(`🛫 ${t('requestSent', t('activationOperationType'))}`);
            confirmOperation(tezos, activation.operation.hash).then(() => {
              setSuccess(`✅ ${t('accountActivated')}`);
            });
            break;
        }
      } catch (err: unknown) {
        console.error(err);

        const mes = t('failureSecretMayBeInvalid');
        setError('secret', { type: SUBMIT_ERROR_TYPE, message: mes });
      }
    },
    [clearErrors, submitting, setError, setSuccess, account.publicKeyHash, tezos]
  );

  const submit = useMemo(() => handleSubmit(onSubmit), [handleSubmit, onSubmit]);

  const handleSecretFieldKeyPress = useCallback<KeyboardEventHandler>(
    evt => {
      if (evt.which === 13 && !evt.shiftKey) {
        evt.preventDefault();
        submit();
      }
    },
    [submit]
  );

  return (
    <form className={clsx('w-full h-full mx-auto flex flex-col flex-1', popup && 'pb-8  max-w-sm')} onSubmit={submit}>
      <p className="text-sm text-secondary-white mb-4">
        <T id="activateAccountParagraph" />
      </p>
      <AccountBanner
        account={account}
        labelDescription={
          <>
            <T id="accountToBeActivated" />
            <br />
            <T id="ifYouWantToActivateAnotherAccount" />
          </>
        }
        className="mb-6"
      />

      {success && <Alert type="success" title={t('success')} description={success} autoFocus className="mb-4" />}

      <FormField
        textarea
        rows={1}
        {...register('secret', { required: t('required') })}
        id="activateaccount-secret"
        label={t('activateAccountSecret')}
        labelDescription={t('activateAccountSecretDescription')}
        placeholder={t('activateAccountSecretPlaceholder')}
        errorCaption={errors.secret?.message}
        style={{ resize: 'none' }}
        containerClassName="mb-4 flex-grow"
        onKeyPress={handleSecretFieldKeyPress}
        testID={ActivateAccountSelectors.secretInput}
      />

      <FormSubmitButton
        loading={submitting}
        disabled={submitting || !secret.length}
        className="mt-8"
        testID={ActivateAccountSelectors.activateButton}
        testIDProperties={{ accountTypeEnum: account.type }}
      >
        <T id="activate" />
      </FormSubmitButton>
    </form>
  );
});

export default ActivateAccount;
