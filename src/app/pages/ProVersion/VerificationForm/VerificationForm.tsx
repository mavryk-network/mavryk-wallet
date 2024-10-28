import React, { FC, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import classNames from 'clsx';
import { Controller, useForm } from 'react-hook-form';

import { Anchor, NoSpaceField } from 'app/atoms';
import { useAppEnv } from 'app/env';
import OperationStatus from 'app/templates/OperationStatus';
import { useFormAnalytics } from 'lib/analytics';
import { useGasToken } from 'lib/assets/hooks';
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

type DelegateFormProps = {
  setToolbarRightSidedComponent: React.Dispatch<React.SetStateAction<JSX.Element | null>>;
};

const VerificationForm: FC<DelegateFormProps> = ({ setToolbarRightSidedComponent }) => {
  const { registerBackHandler } = useAppEnv();
  const formAnalytics = useFormAnalytics('AddressValidationForm');
  const { isDcpNetwork } = useGasToken();
  const { popup } = useAppEnv();

  const { pathname } = useLocation();

  const tezos = useTezos();

  const domainsClient = useTezosDomainsClient();
  const canUseDomainNames = domainsClient.isSupported;

  /**
   * Form
   */

  const { watch, handleSubmit, errors, control, formState, setValue, triggerValidation, reset } = useForm<FormData>({
    mode: 'onChange'
  });

  const toValue = watch('to');

  const toFilledWithAddress = useMemo(() => Boolean(toValue && isAddressValid(toValue)), [toValue]);
  const toFilledWithDomain = useMemo(
    () => toValue && isDomainNameValid(toValue, domainsClient),
    [toValue, domainsClient]
  );
  const { data: resolvedAddress } = useTezosAddressByDomainName(toValue);

  const toFieldRef = useRef<HTMLTextAreaElement>(null);

  const toFilled = useMemo(
    () => (resolvedAddress ? toFilledWithDomain : toFilledWithAddress),
    [toFilledWithAddress, toFilledWithDomain, resolvedAddress]
  );

  const toResolved = useMemo(() => resolvedAddress || toValue, [resolvedAddress, toValue]);

  const cleanToField = useCallback(() => {
    setValue('to', '');
    triggerValidation('to');
  }, [setValue, triggerValidation]);

  useLayoutEffect(() => {
    if (pathname === '/stake') {
      cleanToField();
    }
  }, [pathname, cleanToField]);

  useLayoutEffect(() => {
    if (toFilled) {
      return registerBackHandler(() => {
        cleanToField();
        window.scrollTo(0, 0);
      });
    }
    return undefined;
  }, [toFilled, registerBackHandler, cleanToField]);

  const AllValidatorsComponent = useMemo(
    () => (
      <Anchor href={`${process.env.NODES_URL}/validators`} className="text-base-plus text-accent-blue cursor-pointer">
        All Validators
      </Anchor>
    ),
    []
  );

  useEffect(() => {
    setToolbarRightSidedComponent(AllValidatorsComponent);

    return () => {
      setToolbarRightSidedComponent(null);
    };
  }, []);

  const memoizedValidateAddress = useMemo(() => (value: any) => validateAnyAddress(value), []);

  const [submitError, setSubmitError] = useSafeState<ReactNode>(null, `${tezos.checksum}_${toResolved}`);
  const [operation, setOperation] = useSafeState<any>(null, tezos.checksum);

  useEffect(() => {
    if (operation && (!operation._operationResult.hasError || !operation._operationResult.isStopped)) {
      // navigate to success screen
      const hash = operation.hash || operation.opHash;

      navigate<SuccessStateType>('/success', undefined, {
        pageTitle: 'stake',
        btnText: 'goToMain',
        contentId: 'hash',
        contentIdFnProps: { hash, i18nKey: 'staking' },
        subHeader: 'success'
      });
    }
  }, [operation]);

  const onSubmit = useCallback(
    async ({}: FormData) => {
      const to = toResolved;
      if (formState.isSubmitting) return;
      setSubmitError(null);
      setOperation(null);

      const analyticsProperties = { bakerAddress: to };

      formAnalytics.trackSubmit(analyticsProperties);
      try {
        reset({ to: '' });

        formAnalytics.trackSubmitSuccess(analyticsProperties);
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
    [toResolved, formState.isSubmitting, setSubmitError, setOperation, formAnalytics, reset]
  );

  const restFormDisplayed = Boolean(toFilled);

  return (
    <div className={classNames(!restFormDisplayed && popup && 'pt-4', 'h-full flex-1 flex flex-col')}>
      {operation && <OperationStatus typeTitle={t('staking')} operation={operation} className="mb-8 px-4" />}

      <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col flex-1">
        <Controller
          name="to"
          as={<NoSpaceField ref={toFieldRef} />}
          control={control}
          rules={{ validate: memoizedValidateAddress }}
          onChange={([v]) => v}
          onFocus={() => toFieldRef.current?.focus()}
          textarea
          rows={2}
          cleanable={Boolean(toValue)}
          onClean={cleanToField}
          id="delegate-to"
          label={isDcpNetwork ? t('producer') : t('delegateToValidator')}
          placeholder={canUseDomainNames ? t('enterPublicAddressPlaceholder') : t('bakerInputPlaceholder')}
          errorCaption={(errors.to?.message && t(errors.to.message.toString() as TID)) || submitError?.message}
          style={{
            resize: 'none'
          }}
          containerClassName={classNames('mb-4', popup && 'px-4', toFilled && 'hidden')}
          testID={VerificationFormSelectors.addressInput}
        />
      </form>
    </div>
  );
};

export default VerificationForm;
