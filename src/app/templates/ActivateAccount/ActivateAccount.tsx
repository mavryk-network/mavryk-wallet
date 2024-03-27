import React, { memo, KeyboardEventHandler, ReactNode, useCallback, useMemo } from 'react';

import { useForm } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import AccountBanner from 'app/templates/AccountBanner';
import { T, t } from 'lib/i18n';
import { useTezos, useAccount, activateAccount } from 'lib/temple/front';
import { confirmOperation } from 'lib/temple/operation';
import { useSafeState } from 'lib/ui/hooks';

import { ActivateAccountSelectors } from './ActivateAccount.selectors';

type FormData = {
  secret: string;
};

const SUBMIT_ERROR_TYPE = 'submit-error';

const ActivateAccount = memo(() => {
  const tezos = useTezos();
  const account = useAccount();

  const [success, setSuccess] = useSafeState<ReactNode>(null);

  const { register, handleSubmit, formState, clearError, setError, errors, watch } = useForm<FormData>();
  const submitting = formState.isSubmitting;
  const secret = watch('secret') ?? '';

  const onSubmit = useCallback(
    async (data: FormData) => {
      if (submitting) return;

      clearError('secret');
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
      } catch (err: any) {
        console.error(err);

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
});

export default ActivateAccount;
