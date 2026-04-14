import React, { FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import clsx from 'clsx';

import { Alert, FormField, FormSubmitButton } from 'app/atoms';
import { getAccountBadgeTitle } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { usePasswordGateForm } from 'app/hooks/use-password-gate-form';
import AccountBanner from 'app/templates/AccountBanner';
import { T, t } from 'lib/i18n';
import { useAccount, useMavrykClient, useWalletsSpecs } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { useVanishingState } from 'lib/ui/hooks';

import { RevealSecretsSelectors } from './RevealSecrets.selectors';
import { SecretField } from './SecretField';

type RevealSecretProps = {
  reveal: 'private-key' | 'seed-phrase';
};

const RevealSecret: FC<RevealSecretProps> = ({ reveal }) => {
  const walletsSpecs = useWalletsSpecs();
  const { revealPrivateKey, revealMnemonic } = useMavrykClient();
  const account = useAccount();
  const { popup } = useAppEnv();
  const walletId = account.type === TempleAccountType.HD ? account.walletId : Object.keys(walletsSpecs)[0];

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

  const handleAction = useCallback(
    async (pw: string) => {
      let scrt: string;

      switch (reveal) {
        case 'private-key':
          scrt = await revealPrivateKey(account.publicKeyHash, pw);
          break;

        case 'seed-phrase':
          scrt = await revealMnemonic(walletId, pw);
          break;
      }

      setSecret(scrt);
    },
    [reveal, revealPrivateKey, account.publicKeyHash, revealMnemonic, walletId, setSecret]
  );

  const { registerPassword, handleSubmit, errors, submitting, password: walletPasswordValue, onSubmit } =
    usePasswordGateForm(handleAction, { onError: focusPasswordField, clearOnChange: true });

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
        onSubmit={onSubmit}
        className={clsx('flex-grow flex flex-col justify-between', popup && 'pb-8')}
      >
        <FormField
          {...registerPassword(t('required'))}
          label={t('password')}
          id="reveal-secret-password"
          type="password"
          placeholder={t('enterWalletPassword')}
          errorCaption={errors.password?.message}
          containerClassName="mb-4"
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
    account
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
