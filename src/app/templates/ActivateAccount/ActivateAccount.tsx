import React, { FC, KeyboardEventHandler, ReactNode, useCallback, useMemo, useState } from 'react';

import { useForm } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import AccountBanner from 'app/templates/AccountBanner';
import { T, t } from 'lib/i18n';
import { ActivationStatus, useTezos, useAccount, activateAccount } from 'lib/temple/front';
import { confirmOperation } from 'lib/temple/operation';
import { useIsMounted } from 'lib/ui/hooks';
import { delay } from 'lib/utils';

import { ActivateAccountSelectors } from './ActivateAccount.selectors';

type FormData = {
  secret: string;
};

const SUBMIT_ERROR_TYPE = 'submit-error';

const ActivateAccount: FC = () => {
  const tezos = useTezos();
  const account = useAccount();
  const isMounted = useIsMounted();

  const [success, setSuccessPure] = useState<ReactNode>(null);
  const setSuccess = useCallback<typeof setSuccessPure>(
    val => {
      if (isMounted()) {
        setSuccessPure(val);
      }
    },
    [setSuccessPure, isMounted]
  );

  const { register, handleSubmit, formState, clearError, setError, errors, watch } = useForm<FormData>();
  const submitting = formState.isSubmitting;
  const secret = watch('secret') ?? '';

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (submitting) return;

      clearError('secret');
      setSuccess(null);

      try {
        const [activationStatus, op] = await activateAccount(
          account.publicKeyHash,
          data.secret.replace(/\s/g, ''),
          tezos
        );
        switch (activationStatus) {
          case ActivationStatus.AlreadyActivated:
            setSuccess(`🏁 ${t('accountAlreadyActivated')}`);
            break;

          case ActivationStatus.ActivationRequestSent:
            setSuccess(`🛫 ${t('requestSent', t('activationOperationType'))}`);
            confirmOperation(tezos, op!.hash).then(() => {
              setSuccess(`✅ ${t('accountActivated')}`);
            });
            break;
        }
      } catch (err: any) {
        console.error(err);

        // Human delay.
        await delay();
        const mes = t('failureSecretMayBeInvalid');
        setError('secret', SUBMIT_ERROR_TYPE, mes);
      }
    },
    [clearError, submitting, setError, setSuccess, account.publicKeyHash, tezos]
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
    <form className="w-full h-full max-w-sm mx-auto flex flex-col pb-8" onSubmit={submit}>
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
        ref={register({ required: t('required') })}
        name="secret"
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
};

export default ActivateAccount;
