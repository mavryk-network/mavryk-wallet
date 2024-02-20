import React, { FC, useCallback, useEffect, useRef } from 'react';

import { OnSubmit, useForm } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import AccountBanner from 'app/templates/AccountBanner';
import { T, t } from 'lib/i18n';
import { useTempleClient, useRelevantAccounts, useAccount } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { delay } from 'lib/utils';
import { navigate } from 'lib/woozie';

import { RemoveAccountSelectors } from './RemoveAccount.selectors';

const SUBMIT_ERROR_TYPE = 'submit-error';

type FormData = {
  password: string;
};

const RemoveAccount: FC = () => {
  const { removeAccount } = useTempleClient();
  const allAccounts = useRelevantAccounts();
  const account = useAccount();

  const prevAccLengthRef = useRef(allAccounts.length);
  useEffect(() => {
    const accLength = allAccounts.length;
    if (prevAccLengthRef.current > accLength) {
      navigate('/');
    }
    prevAccLengthRef.current = accLength;
  }, [allAccounts]);

  const { register, handleSubmit, errors, setError, clearError, formState, watch } = useForm<FormData>();
  const submitting = formState.isSubmitting;
  const password = watch('password') ?? '';

  const onSubmit = useCallback<OnSubmit<FormData>>(
    async ({ password }) => {
      if (submitting) return;

      clearError('password');
      try {
        await removeAccount(account.publicKeyHash, password);
      } catch (err: any) {
        console.error(err);

        // Human delay.
        await delay();
        setError('password', SUBMIT_ERROR_TYPE, err.message);
      }
    },
    [submitting, clearError, setError, removeAccount, account.publicKeyHash]
  );

  return (
    <div className="w-full h-full max-w-sm mx-auto flex flex-col pb-8">
      <p className="text-sm text-secondary-white mb-4">
        <T id="removeAccountParagraph" />
      </p>
      <AccountBanner
        account={account}
        labelDescription={
          <>
            <T id="accountToBeRemoved" />
            <br />
            <T id="ifYouWantToRemoveAnotherAccount" />
          </>
        }
      />

      {account.type === TempleAccountType.HD ? (
        <Alert
          title={`${t('attention')}!`}
          description={
            <p>
              <T id="accountsToRemoveConstraint" />
            </p>
          }
          className="my-4"
        />
      ) : (
        <>
          <Alert title={t('attention')} description={t('removeAccountMessage')} className="mb-4" />
          <form onSubmit={handleSubmit(onSubmit)} className="flex-grow flex flex-col">
            <FormField
              ref={register({ required: t('required') })}
              label={t('password')}
              id="removeacc-secret-password"
              type="password"
              name="password"
              placeholder={t('enterWalletPassword')}
              errorCaption={errors.password?.message}
              containerClassName="flex-grow"
              testID={RemoveAccountSelectors.passwordInput}
            />

            <FormSubmitButton
              loading={submitting}
              disabled={submitting || !password.length}
              testID={RemoveAccountSelectors.removeButton}
              testIDProperties={{ accountTypeEnum: account.type }}
              className="mt-8"
            >
              <T id="remove" />
            </FormSubmitButton>
          </form>
        </>
      )}
    </div>
  );
};

export default RemoveAccount;
