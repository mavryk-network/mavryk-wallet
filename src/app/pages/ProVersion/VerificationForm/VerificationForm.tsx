import React, { FC, ReactNode, useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import clsx from 'clsx';
import { Controller, useForm } from 'react-hook-form';

import { NoSpaceField } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { useFormAnalytics } from 'lib/analytics';
import { TID, T, t } from 'lib/i18n';
import { isDomainNameValid, useTezos, useTezosDomainsClient } from 'lib/temple/front';
import { useTezosAddressByDomainName } from 'lib/temple/front/tzdns';
import { validateAnyAddress } from 'lib/temple/front/validate-delegate';
import { isAddressValid } from 'lib/temple/helpers';
import { useSafeState } from 'lib/ui/hooks';
import { delay } from 'lib/utils';
import { navigate, useLocation } from 'lib/woozie';

import { SuccessStateType } from '../../SuccessScreen/SuccessScreen';

import { VerificationFormSelectors } from './verificationForm.selectors';

interface FormData {
  to: string;
}

export const RECOMMENDED_BAKER_ADDRESS = 'tz1aRoaRhSpRYvFdyvgWLL6TGyRoGF51wDjM';
export const HELP_UKRAINE_BAKER_ADDRESS = 'tz1bMFzs2aECPn4aCRmKQWHSLHF8ZnZbYcah';

type DelegateFormProps = {};

const VerificationForm: FC<DelegateFormProps> = () => {
  const formAnalytics = useFormAnalytics('AddressValidationForm');
  const { popup } = useAppEnv();

  const tezos = useTezos();

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

  const memoizedValidateAddress = useMemo(() => (value: any) => validateAnyAddress(value), []);

  const [submitError, setSubmitError] = useSafeState<ReactNode>(null, `${tezos.checksum}_${toResolved}`);

  const onSubmit = useCallback(
    async (_: FormData) => {
      const to = toResolved;
      if (formState.isSubmitting) return;
      setSubmitError(null);

      const analyticsProperties = { bakerAddress: to };

      formAnalytics.trackSubmit(analyticsProperties);
      try {
        reset({ to: '' });

        formAnalytics.trackSubmitSuccess(analyticsProperties);

        navigate<SuccessStateType>('/success', undefined, {
          pageTitle: 'addressVerification',
          btnText: 'goToMavopoly',
          description: 'veridyAddressSuccessMsg',
          subHeader: 'success'
        });
      } catch (err: any) {
        formAnalytics.trackSubmitFail(analyticsProperties);

        if (err.message === 'Declined') {
          return;
        }

        console.error(err);

        // Human delay.
        await delay();
        setSubmitError(err);
      }
    },
    [toResolved, formState.isSubmitting, setSubmitError, formAnalytics, reset]
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
          rules={{ validate: memoizedValidateAddress }}
          onChange={([v]) => v}
          onFocus={() => toFieldRef.current?.focus()}
          textarea
          rows={2}
          // cleanable={Boolean(toValue)}
          // onClean={cleanToField}
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
            disabled={!toResolved}
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
