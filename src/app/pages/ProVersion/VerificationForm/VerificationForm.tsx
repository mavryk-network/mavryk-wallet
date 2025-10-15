import React, { FC, useCallback, useMemo, useRef } from 'react';

import clsx from 'clsx';
import { Controller, useForm } from 'react-hook-form';

import { NoSpaceField } from 'app/atoms';
import { getErrorMsgByCode } from 'app/consts/errorCodes';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { useFormAnalytics } from 'lib/analytics';
import { TID, T, t } from 'lib/i18n';
import { useChainId, useNetwork, useTezos, validateContractAddress } from 'lib/temple/front';
import { useTezosAddressByDomainName } from 'lib/temple/front/tzdns';
import { useSafeState } from 'lib/ui/hooks';
import { delay } from 'lib/utils';
import { isNumeric } from 'lib/utils/numbers';
import { navigate } from 'lib/woozie';

import { SuccessStateType } from '../../SuccessScreen/SuccessScreen';
import { signKYCAction } from '../utils/tezosSigner';

import { VerificationFormSelectors } from './verificationForm.selectors';

interface FormData {
  to: string;
}

type DelegateFormProps = {};

const VerificationForm: FC<DelegateFormProps> = () => {
  const formAnalytics = useFormAnalytics('AddressValidationForm');
  const { popup } = useAppEnv();
  const { rpcBaseURL: rpcUrl } = useNetwork();
  const tezos = useTezos();
  const chainId = useChainId();

  /**
   * Form
   */

  const { watch, handleSubmit, errors, control, formState, reset } = useForm<FormData>({
    mode: 'onChange'
  });

  const toValue = watch('to');

  const { data: resolvedAddress } = useTezosAddressByDomainName(toValue);

  const toFieldRef = useRef<HTMLTextAreaElement>(null);

  const toResolved = useMemo(() => resolvedAddress || toValue, [resolvedAddress, toValue]);

  // const memoizedValidateAddress = useMemo(() => (value: any) => validateAnyAddress(value), []);

  const [submitError, setSubmitError] = useSafeState<{ message: string } | null>(
    null,
    `${tezos.checksum}_${toResolved}`
  );

  const onSubmit = useCallback(
    async (_: FormData) => {
      const to = toResolved;
      if (formState.isSubmitting) return;
      setSubmitError(null);

      const analyticsProperties = { enteredAddress: to };

      formAnalytics.trackSubmit(analyticsProperties);
      try {
        const isAddressVerified = validateContractAddress(to);

        if (isAddressVerified !== true) throw new Error(t('verifyAddressErrMsg'));

        // make account a KYC account
        await signKYCAction(rpcUrl, to, chainId);

        reset({ to: '' });

        formAnalytics.trackSubmitSuccess(analyticsProperties);

        navigate<SuccessStateType>('/success', undefined, {
          pageTitle: 'addressVerification',
          btnText: 'goToMain',
          btnLink: '/',
          description: 'veridyAddressSuccessMsg',
          subHeader: 'success'
        });
      } catch (err: any) {
        formAnalytics.trackSubmitFail(analyticsProperties);

        if (err.message === 'Declined') {
          return;
        }

        // Human delay.
        await delay();

        if (isNumeric(err.message)) {
          return setSubmitError({ message: getErrorMsgByCode(err.message) });
        }

        setSubmitError(err);
      }
    },
    [toResolved, formState.isSubmitting, setSubmitError, formAnalytics, rpcUrl, reset, chainId]
  );

  return (
    <div className={clsx(popup ? 'pt-2' : 'pt-4', 'h-full flex-1 flex flex-col')}>
      <p className={clsx('text-sm text-secondary-white mb-2', popup && 'px-4')}>
        <T id="addressVerificationDescr" />
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col justify-between flex-1">
        <Controller
          name="to"
          as={<NoSpaceField ref={toFieldRef} />}
          control={control}
          // will no allow form submitting is address is invalid
          // rules={{ validate: memoizedValidateAddress }}
          onChange={([v]) => v}
          onFocus={() => toFieldRef.current?.focus()}
          textarea
          rows={2}
          id="validate-to"
          label={t('contractAddress')}
          placeholder={t('enterContractAddressPlaceholder')}
          errorCaption={(errors.to?.message && t(errors.to.message.toString() as TID)) || submitError?.message}
          style={{
            resize: 'none'
          }}
          containerClassName={clsx('mb-4', popup && 'px-4')}
          testID={VerificationFormSelectors.addressInput}
        />
        <div className={clsx(popup && 'px-4')}>
          <ButtonRounded
            isLoading={formState.isSubmitting}
            disabled={!toResolved || formState.isSubmitting || Boolean(submitError?.message)}
            size="big"
            type="submit"
            className={clsx('w-full', popup ? 'mt-40px' : 'mt-18')}
            fill
          >
            <T id="verify" />
          </ButtonRounded>
        </div>
      </form>
    </div>
  );
};

export default VerificationForm;
