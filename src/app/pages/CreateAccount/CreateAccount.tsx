import React, { FC, useCallback, useEffect, useMemo, useRef } from 'react';

import classNames from 'clsx';
import { OnSubmit, useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN } from 'app/defaults';
import PageLayout from 'app/layouts/PageLayout';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useTempleClient, useAllAccounts, useSetAccountPkh } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { delay } from 'lib/utils';
import { Link, navigate } from 'lib/woozie';

import { SuccessStateType } from '../SuccessScreen/SuccessScreen';
import { CreateAccountSelectors } from './CreateAccount.selectors';

type FormData = {
  name: string;
};

const SUBMIT_ERROR_TYPE = 'submit-error';

const CreateAccount: FC = () => {
  const { createAccount } = useTempleClient();

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
        <>
          <T id="createAccount" />
        </>
      }
      isTopbarVisible={false}
    >
      <div className="w-full max-w-sm mx-auto h-full flex flex-col justify-start pb-8">
        <div className="text-sm text-secondary-white mb-4">
          This is to create a new account using the private key of your current wallet. If you want to restore an
          account, please go{' '}
          <Link
            to="/import-wallet"
            className={classNames(
              'text-accent-blue',
              'text-sm font-semibold',
              'transition duration-200 ease-in-out',
              'opacity-75 hover:opacity-100 focus:opacity-100'
            )}
            testID={CreateAccountSelectors.restoreWalletUsingSeedPhrase}
          >
            <T id="here" />.
          </Link>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full justify-between">
          <FormField
            ref={register({
              pattern: {
                value: ACCOUNT_NAME_PATTERN,
                message: t('accountNameInputTitle')
              }
            })}
            label={t('accountName')}
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
            <T id="createAccount" />
          </FormSubmitButton>
        </form>
      </div>
    </PageLayout>
  );
};

export default CreateAccount;
