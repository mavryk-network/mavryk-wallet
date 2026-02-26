import React, { FC, useCallback, useEffect, useMemo, useRef } from 'react';

import clsx from 'clsx';
import { SubmitHandler, useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN } from 'app/defaults';
import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useTempleClient, useAllAccounts, useSetAccountPkh } from 'lib/temple/front';
import { useAccount } from 'lib/temple/front/ready';
import { TempleAccountType } from 'lib/temple/types';
import { delay } from 'lib/utils';
import { navigate } from 'lib/woozie';

import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

import { CreateAccountSelectors } from './CreateAccount.selectors';

type FormData = {
  name: string;
};

const SUBMIT_ERROR_TYPE = 'submit-error';

const CreateAccount: FC = () => {
  const { createAccount, walletsSpecs } = useTempleClient();
  const { popup } = useAppEnv();
  const account = useAccount();
  const walletId = account.type === TempleAccountType.HD ? account.walletId : undefined;

  const allAccounts = useAllAccounts();
  const setAccountPkh = useSetAccountPkh();
  const formAnalytics = useFormAnalytics('CreateAccount');

  const currentWalletId = useMemo(
    () => Object.keys(walletsSpecs).find(id => id === walletId) ?? Object.keys(walletsSpecs)[0],
    [walletId, walletsSpecs]
  );

  const allHDOrImported = useMemo(
    () => allAccounts.filter(acc => [TempleAccountType.HD, TempleAccountType.Imported].includes(acc.type)),
    [allAccounts]
  );

  const defaultName = useMemo(
    () => t('defaultAccountName', String(allHDOrImported.length + 1)),
    [allHDOrImported.length]
  );

  const prevAccLengthRef = useRef(allAccounts.length);
  useEffect(() => {
    const accLength = allAccounts.length;
    if (prevAccLengthRef.current < accLength) {
      setAccountPkh(allAccounts[accLength - 1].publicKeyHash);
      navigate<SuccessStateType>('/success', undefined, {
        pageTitle: 'createAccount',
        btnText: 'goToMain',
        description: 'createAccountSuccess',
        subHeader: 'success'
      });
    }
    prevAccLengthRef.current = accLength;
  }, [allAccounts, setAccountPkh]);

  const { register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { name: defaultName }
  });
  const submitting = isSubmitting;

  const onSubmit = useCallback<SubmitHandler<FormData>>(
    async ({ name }) => {
      if (submitting) return;

      clearErrors('name');

      formAnalytics.trackSubmit();
      try {
        await createAccount(currentWalletId, name);

        formAnalytics.trackSubmitSuccess();
      } catch (err: any) {
        formAnalytics.trackSubmitFail();

        console.error(err);

        // Human delay.
        await delay();
        setError('name', { type: SUBMIT_ERROR_TYPE, message: err.message });
      }
    },
    [submitting, clearErrors, formAnalytics, createAccount, currentWalletId, setError]
  );

  return (
    <PageLayout
      pageTitle={
        <span className="capitalize">
          <T id="createAccount" />
        </span>
      }
      isTopbarVisible={false}
    >
      <div
        className={clsx(
          'w-full mx-auto h-full flex flex-col flex-1 justify-start',
          popup ? 'max-w-sm  pb-8' : 'max-w-screen-xxs'
        )}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 h-full justify-between">
          <FormField
            {...register('name', {
              pattern: {
                value: ACCOUNT_NAME_PATTERN,
                message: t('accountNameInputTitle')
              }
            })}
            label={t('newAccountName')}
            labelDescription={t('accountNameInputDescription')}
            id="create-account-name"
            type="text"
            placeholder={defaultName}
            errorCaption={errors.name?.message}
            containerClassName="mb-4"
            testID={CreateAccountSelectors.accountNameInputField}
          />

          <FormSubmitButton
            className="capitalize"
            loading={submitting}
            testID={CreateAccountSelectors.createOrRestoreButton}
          >
            <T id="addNewAccount" />
          </FormSubmitButton>
        </form>
      </div>
    </PageLayout>
  );
};

export default CreateAccount;
