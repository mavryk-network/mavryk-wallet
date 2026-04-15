import React, { FC, useCallback, useEffect, useRef } from 'react';

import clsx from 'clsx';

import { FormField, FormSubmitButton } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { usePasswordGateForm } from 'app/hooks/use-password-gate-form';
import { BTN_ERROR, ButtonRounded } from 'app/molecules/ButtonRounded';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T, t } from 'lib/i18n';
import { useAccount, useRelevantAccounts, useMavrykClient } from 'lib/temple/front';
import { navigate } from 'lib/woozie';

import { EditableTitleSelectors } from '../editAccount.selectors';

type RemoveAccountPopupProps = {
  opened: boolean;
  close: () => void;
  accountId: string;
  onRemoved?: () => void;
};

export const RemoveAccountPopup: FC<RemoveAccountPopupProps> = ({ opened, close, accountId, onRemoved }) => {
  const { removeAccount } = useMavrykClient();
  const allAccounts = useRelevantAccounts();
  const account = useAccount();
  const { popup } = useAppEnv();
  const removedWithCustomNavRef = useRef(false);

  const prevAccLengthRef = useRef(allAccounts.length);
  useEffect(() => {
    const accLength = allAccounts.length;
    if (prevAccLengthRef.current > accLength) {
      if (!removedWithCustomNavRef.current) {
        navigate('/');
      }
    }
    prevAccLengthRef.current = accLength;
  }, [allAccounts]);

  const handleAction = useCallback(
    async (pw: string) => {
      await removeAccount(accountId, pw);
      if (onRemoved) {
        removedWithCustomNavRef.current = true;
        onRemoved();
      }
    },
    [removeAccount, accountId, onRemoved]
  );

  const { registerPassword, errors, submitting, onSubmit, disabled } = usePasswordGateForm(handleAction);

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={'Remove Account?'}
      portalClassName="edit-account-name-popup-portal"
    >
      <div className={clsx('flex flex-col', popup ? 'px-4' : 'px-12')}>
        <form onSubmit={onSubmit} className="flex-grow flex flex-col">
          <FormField
            {...registerPassword(t('required'))}
            label={t('password')}
            id="removeacc-secret-password"
            type="password"
            placeholder={t('enterWalletPassword')}
            errorCaption={errors.password?.message}
            containerClassName="flex-grow"
            testID={EditableTitleSelectors.passwordInput}
          />

          <div className="w-full grid grid-cols-2 gap-3">
            <ButtonRounded
              btnType={BTN_ERROR}
              type="button"
              size="big"
              fill={false}
              className="w-full mt-8"
              onClick={close}
              testID={EditableTitleSelectors.cancelButton}
            >
              <T id="cancel" />
            </ButtonRounded>
            <FormSubmitButton
              btnType={BTN_ERROR}
              loading={submitting}
              disabled={disabled}
              testID={EditableTitleSelectors.removeButton}
              testIDProperties={{ accountTypeEnum: account.type }}
              className="mt-8"
            >
              <T id="remove" />
            </FormSubmitButton>
          </div>
        </form>
      </div>
    </PopupModalWithTitle>
  );
};
