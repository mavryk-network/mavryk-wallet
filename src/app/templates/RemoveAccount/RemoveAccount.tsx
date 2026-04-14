import React, { FC, useEffect, useRef } from 'react';

import clsx from 'clsx';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { usePasswordGateForm } from 'app/hooks/use-password-gate-form';
import AccountBanner from 'app/templates/AccountBanner';
import { T, t } from 'lib/i18n';
import { useMavrykClient, useRelevantAccounts, useAccount } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { navigate } from 'lib/woozie';

import { RemoveAccountSelectors } from './RemoveAccount.selectors';

const RemoveAccount: FC = () => {
  const { removeAccount } = useMavrykClient();
  const allAccounts = useRelevantAccounts();
  const account = useAccount();
  const { popup } = useAppEnv();

  const prevAccLengthRef = useRef(allAccounts.length);
  useEffect(() => {
    const accLength = allAccounts.length;
    if (prevAccLengthRef.current > accLength) {
      navigate('/');
    }
    prevAccLengthRef.current = accLength;
  }, [allAccounts]);

  const { registerPassword, handleSubmit, errors, submitting, password, onSubmit, disabled } = usePasswordGateForm(
    pw => removeAccount(account.id, pw)
  );

  return (
    <div className={clsx('w-full h-full mx-auto flex flex-col flex-1', popup && 'pb-8  max-w-sm')}>
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
        className={clsx(account.type !== TempleAccountType.HD && 'mb-4')}
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
          <form onSubmit={onSubmit} className="flex-grow flex flex-col">
            <FormField
              {...registerPassword(t('required'))}
              label={t('password')}
              id="removeacc-secret-password"
              type="password"
              placeholder={t('enterWalletPassword')}
              errorCaption={errors.password?.message}
              containerClassName="flex-grow"
              testID={RemoveAccountSelectors.passwordInput}
            />

            <FormSubmitButton
              loading={submitting}
              disabled={disabled}
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
