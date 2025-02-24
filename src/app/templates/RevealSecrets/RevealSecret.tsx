import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import clsx from 'clsx';
import { OnSubmit, useForm } from 'react-hook-form';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import { getAccountBadgeTitle } from 'app/defaults';
import { useAppEnv } from 'app/env';
import AccountBanner from 'app/templates/AccountBanner';
import { T, t } from 'lib/i18n';
import { useAccount, useTempleClient } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { useVanishingState } from 'lib/ui/hooks';
import { delay } from 'lib/utils';

import { RevealSecretsSelectors } from './RevealSecrets.selectors';
import { SecretField } from './SecretField';

const SUBMIT_ERROR_TYPE = 'submit-error';

type FormData = {
  password: string;
};

type RevealSecretProps = {
  reveal: 'private-key' | 'seed-phrase';
};

const RevealSecret: FC<RevealSecretProps> = ({ reveal }) => {
  const { revealPrivateKey, revealMnemonic } = useTempleClient();
  const account = useAccount();
  const { popup } = useAppEnv();

  const { register, handleSubmit, errors, setError, clearError, formState, watch } = useForm<FormData>();
  const submitting = formState.isSubmitting;

  const walletPasswordValue = watch('password') ?? '';

  const [secret, setSecret] = useVanishingState();

  useEffect(() => {
    if (account.publicKeyHash) {
      return () => setSecret(null);
    }
    return undefined;
  }, [account.publicKeyHash, setSecret]);

  const formRef = useRef<HTMLFormElement>(null);

  const focusPasswordField = useCallback(() => {
    formRef.current?.querySelector<HTMLInputElement>("input[name='password']")?.focus();
  }, []);

  useLayoutEffect(() => {
    focusPasswordField();
  }, [focusPasswordField]);

  const onSubmit = useCallback<OnSubmit<FormData>>(
    async ({ password }) => {
      if (submitting) return;

      clearError('password');
      try {
        let scrt: string;

        switch (reveal) {
          case 'private-key':
            scrt = await revealPrivateKey(account.publicKeyHash, password);
            break;

          case 'seed-phrase':
            scrt = await revealMnemonic(password);
            break;
        }

        setSecret(scrt);
      } catch (err: any) {
        console.error(err);

        // Human delay.
        await delay();
        setError('password', SUBMIT_ERROR_TYPE, err.message);
        focusPasswordField();
      }
    },
    [
      reveal,
      submitting,
      clearError,
      setError,
      revealPrivateKey,
      revealMnemonic,
      account.publicKeyHash,
      setSecret,
      focusPasswordField
    ]
  );

  const texts = useMemo(() => {
    switch (reveal) {
      case 'private-key':
        return {
          name: t('privateKey'),
          accountBanner: <AccountBanner account={account} className="mb-4" />,
          derivationPathBanner: account.derivationPath && (
            <div className="mb-6 flex flex-col">
              <label className="mb-4 flex flex-col">
                <span className="text-base font-semibold text-white">
                  <T id="derivationPath" />
                </span>
              </label>
              <input
                className={clsx(
                  'appearance-none w-full py-3 pl-4',
                  'rounded-md border-2 border-gray-300',
                  'bg-transparent text-white text-lg leading-tight'
                )}
                disabled={true}
                value={account.derivationPath}
              />
            </div>
          )
        };

      case 'seed-phrase':
        return {
          name: t('seedPhrase'),
          accountBanner: <AccountBanner account={account} className="mb-4" />,
          derivationPathBanner: (
            <div className="mb-4 flex flex-col">
              <h2 className="mb-3 leading-tight flex flex-col">
                <span className="text-base-plus text-white">
                  <T id="derivationPath" />
                </span>

                <span className={clsx('mt-1 text-sm font-light text-secondary-white', popup ? 'max-w-9/10' : 'w-full')}>
                  <T id="pathForHDAccounts" />
                </span>
              </h2>

              <div className="w-full border rounded-md py-3 px-4 flex items-center">
                <span className="text-base-plus text-white">
                  <T id="derivationPathExample" />
                </span>
              </div>
            </div>
          )
        };
    }
  }, [reveal, account]);

  const forbidPrivateKeyRevealing =
    reveal === 'private-key' &&
    [TempleAccountType.Ledger, TempleAccountType.ManagedKT, TempleAccountType.WatchOnly].includes(account.type);

  const mainContent = useMemo(() => {
    if (forbidPrivateKeyRevealing) {
      return (
        <>
          <Alert
            title={t('privateKeyCannotBeRevealed')}
            description={
              <p>
                <T
                  id="youCannotGetPrivateKeyFromThisAccountType"
                  substitutions={[
                    <span
                      key="account-type"
                      className="rounded-sm border px-1 py-px font-normal leading-tight border-current"
                      style={{
                        fontSize: '0.75em'
                      }}
                    >
                      {getAccountBadgeTitle(account)}
                    </span>
                  ]}
                />
              </p>
            }
            className="my-4"
          />
        </>
      );
    }

    if (secret) return <SecretField value={secret} revealType={reveal} />;

    return (
      <form
        ref={formRef}
        onSubmit={handleSubmit(onSubmit)}
        className={clsx('flex-grow flex flex-col justify-between', popup && 'pb-8')}
      >
        <FormField
          ref={register({ required: t('required') })}
          label={t('password')}
          id="reveal-secret-password"
          type="password"
          name="password"
          placeholder={t('enterWalletPassword')}
          errorCaption={errors.password?.message}
          containerClassName="mb-4"
          onChange={() => clearError()}
          testID={RevealSecretsSelectors.RevealPasswordInput}
        />

        <FormSubmitButton
          disabled={!walletPasswordValue.length}
          loading={submitting}
          testID={RevealSecretsSelectors.RevealButton}
        >
          <T id="reveal" />
        </FormSubmitButton>
      </form>
    );
  }, [
    forbidPrivateKeyRevealing,
    secret,
    reveal,
    handleSubmit,
    onSubmit,
    register,
    errors.password?.message,
    walletPasswordValue.length,
    submitting,
    account,
    clearError
  ]);

  return (
    <div className={clsx('w-full h-full  mx-auto flex flex-col flex-1', popup && 'max-w-sm')}>
      {texts.accountBanner}

      {texts.derivationPathBanner}

      {mainContent}
    </div>
  );
};

export default RevealSecret;
