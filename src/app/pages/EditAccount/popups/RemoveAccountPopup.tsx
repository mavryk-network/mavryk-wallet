import React, { FC, useCallback, useEffect, useRef } from 'react';

import clsx from 'clsx';
import { SubmitHandler, useForm } from 'react-hook-form';

import { FormField, FormSubmitButton } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { BTN_ERROR, ButtonRounded } from 'app/molecules/ButtonRounded';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T, t } from 'lib/i18n';
import { useAccount, useRelevantAccounts, useMavrykClient } from 'lib/temple/front';
import { delay } from 'lib/utils';
import { toFieldError } from 'lib/utils/get-error-message';
import { navigate } from 'lib/woozie';

import { EditableTitleSelectors } from '../editAccount.selectors';

type FormData = {
  password: string;
};

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: submitting },
    setError,
    clearErrors,
    watch
  } = useForm<FormData>();
  const password = watch('password') ?? '';

  const onSubmit = useCallback<SubmitHandler<FormData>>(
    async ({ password }) => {
      if (submitting) return;

      clearErrors('password');
      try {
        await removeAccount(accountId, password);
        if (onRemoved) {
          removedWithCustomNavRef.current = true;
          onRemoved();
        }
      } catch (err: unknown) {
        console.error(err);

        // Human delay.
        await delay();
        setError('password', toFieldError(err));
      }
    },
    [submitting, clearErrors, setError, removeAccount, accountId, onRemoved]
  );

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={'Remove Account?'}
      portalClassName="edit-account-name-popup-portal"
    >
      <div className={clsx('flex flex-col', popup ? 'px-4' : 'px-12')}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-grow flex flex-col">
          <FormField
            {...register('password', { required: t('required') })}
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
              disabled={submitting || !password.length}
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
