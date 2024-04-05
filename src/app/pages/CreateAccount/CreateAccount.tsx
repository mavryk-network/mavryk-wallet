import React, { FC, useCallback, useEffect, useMemo, useRef } from 'react';

import clsx from 'clsx';
import { OnSubmit, useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN } from 'app/defaults';
import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useTempleClient, useAllAccounts, useSetAccountPkh } from 'lib/temple/front';
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
  const { createAccount } = useTempleClient();
  const { popup } = useAppEnv();

  const allAccounts = useAllAccounts();
  const setAccountPkh = useSetAccountPkh();
  const formAnalytics = useFormAnalytics('CreateAccount');

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

  const { register, handleSubmit, errors, setError, clearError, formState } = useForm<FormData>({
    defaultValues: { name: defaultName }
  });
  const submitting = formState.isSubmitting;

  const onSubmit = useCallback<OnSubmit<FormData>>(
    async ({ name }) => {
      if (submitting) return;

      clearError('name');

      formAnalytics.trackSubmit();
      try {
        await createAccount(name);

        formAnalytics.trackSubmitSuccess();
      } catch (err: any) {
        formAnalytics.trackSubmitFail();

        console.error(err);

        // Human delay.
        await delay();
        setError('name', SUBMIT_ERROR_TYPE, err.message);
      }
    },
    [submitting, clearError, setError, createAccount, formAnalytics]
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
          'w-full mx-auto h-full flex flex-col justify-start pb-8',
          popup ? 'max-w-sm' : 'max-w-screen-xxs'
        )}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full justify-between">
          <FormField
            ref={register({
              pattern: {
                value: ACCOUNT_NAME_PATTERN,
                message: t('accountNameInputTitle')
              }
            })}
            label={t('newAccountName')}
            labelDescription={t('accountNameInputDescription')}
            id="create-account-name"
            type="text"
            name="name"
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
