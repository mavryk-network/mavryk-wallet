import React, { FC, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { DEFAULT_FEE, TransactionOperation, WalletOperation } from '@mavrykdynamics/webmavryk';
import { useQuery } from '@tanstack/react-query';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';
import { Controller, useForm } from 'react-hook-form';

import { Alert, Anchor, NoSpaceField } from 'app/atoms';
import { ArtificialError, NotEnoughFundsError, ZeroBalanceError } from 'app/defaults';
import { useAppEnv } from 'app/env';
import OperationStatus from 'app/templates/OperationStatus';
import { useFormAnalytics } from 'lib/analytics';
import { submitDelegation } from 'lib/apis/everstake';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useGasToken } from 'lib/assets/hooks';
import { useBalance } from 'lib/balances';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { T, t, TID } from 'lib/i18n';
import { RECOMMENDED_BAKER_ADDRESS } from 'lib/known-bakers';
import { MAVEN_METADATA } from 'lib/metadata';
import { setDelegate } from 'lib/michelson';
import { feeKeys } from 'lib/query-keys';
import { loadContract } from 'lib/temple/contract';
import {
  useAccount,
  useAddressResolution,
  useChainId,
  useDelegate,
  useKnownBaker,
  useTezos,
  useTezosDomainsClient,
  validateDelegate
} from 'lib/temple/front';
import { atomsToTokens, hasManager, mumavToTz, tzToMumav } from 'lib/temple/helpers';
import { buildPendingOperationObject, putOperationIntoStorage } from 'lib/temple/history/utils';
import { TempleAccountType } from 'lib/temple/types';
import { useSafeState } from 'lib/ui/hooks';
import { delay, fifoResolve } from 'lib/utils';
import { ZERO } from 'lib/utils/numbers';
import { navigate, useLocation } from 'lib/woozie';

import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

import { AdvancedBakerBannerComponent } from './components/BakerBannerComponent';
import { BakerForm, BakerFormProps } from './components/BakerForm';
import { UnchangedError, UnregisteredDelegateError, validateAddress } from './components/delegate-errors';
import { DelegateFormSelectors } from './delegateForm.selectors';
import { useEstimationRef } from './hooks/use-estimation-ref';

const PENNY = 0.000001;
const RECOMMENDED_ADD_FEE = 0.0001;

interface FormData {
  to: string;
  fee: number;
}

type DelegateFormProps = {
  unfamiliarWithDelegation: boolean;
  isFromCoStakeNavigation: boolean;
  isReDelegationActive: boolean;
  activateReDelegation: () => void;
  setToolbarRightSidedComponent: React.Dispatch<React.SetStateAction<JSX.Element | null>>;
};

const DelegateForm: FC<DelegateFormProps> = ({
  setToolbarRightSidedComponent,
  unfamiliarWithDelegation,
  isFromCoStakeNavigation,
  isReDelegationActive,
  activateReDelegation
}) => {
  const { registerBackHandler } = useAppEnv();
  const formAnalytics = useFormAnalytics('DelegateForm');
  const { isDcpNetwork } = useGasToken();
  const { popup } = useAppEnv();

  const { pathname } = useLocation();
  const isStakeScreenWithBakersList = useMemo(() => pathname.split('/').pop() === 'stake', [pathname]);

  const acc = useAccount();
  const tezos = useTezos();

  const accountPkh = acc.publicKeyHash;

  const { data: accStats } = useDelegate(accountPkh);
  const myBakerPkh = accStats?.delegate?.address ?? null;

  const { value: balanceData } = useBalance(MAV_TOKEN_SLUG, accountPkh);
  const balance = balanceData ?? new BigNumber(0);
  const balanceNum = balance?.toNumber() ?? ZERO;
  const domainsClient = useTezosDomainsClient();
  const canUseDomainNames = domainsClient.isSupported;
  const chainId = useChainId();

  /**
   * Form
   */

  const {
    watch,
    handleSubmit,
    formState: { errors, ...formState },
    control,
    setValue,
    trigger,
    reset
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      fee: RECOMMENDED_ADD_FEE
    }
  });

  const toValue = watch('to');
  const { resolvedAddress, toFilled, toResolved } = useAddressResolution(toValue);

  const toFieldRef = useRef<HTMLTextAreaElement>(null);
  const estimationRef = useEstimationRef(toResolved, tezos.checksum);

  const getEstimation = useCallback(async () => {
    const to = toResolved;
    if (acc.type === TempleAccountType.ManagedKT) {
      const contract = await loadContract(tezos, accountPkh);
      const transferParams = contract.methods.do(setDelegate(to)).toTransferParams();
      return tezos.estimate.transfer(transferParams);
    } else {
      return tezos.estimate.setDelegate({
        source: accountPkh,
        delegate: to
      });
    }
  }, [tezos, accountPkh, acc.type, toResolved]);

  const cleanToField = useCallback(() => {
    setValue('to', '');
    trigger('to');
  }, [setValue, trigger]);

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
        <T id="allValidators" />
      </Anchor>
    ),
    []
  );

  useEffect(() => {
    if (isStakeScreenWithBakersList) {
      setToolbarRightSidedComponent(AllValidatorsComponent);
    }

    return () => {
      setToolbarRightSidedComponent(null);
    };
  }, [isStakeScreenWithBakersList]);

  const estimateBaseFee = useCallback(async () => {
    try {
      if (balance.isZero()) {
        throw new ZeroBalanceError();
      }

      const estmtn = await getEstimation();
      estimationRef.current = estmtn;
      const manager = await tezos.rpc.getManagerKey(
        acc.type === TempleAccountType.ManagedKT ? acc.publicKeyHash : accountPkh
      );
      let baseFee = mumavToTz(estmtn.burnFeeMumav + estmtn.suggestedFeeMumav);
      if (!hasManager(manager) && acc.type !== TempleAccountType.ManagedKT) {
        baseFee = baseFee.plus(mumavToTz(DEFAULT_FEE.REVEAL));
      }

      if (baseFee.isGreaterThanOrEqualTo(balance)) {
        throw new NotEnoughFundsError();
      }

      return baseFee;
    } catch (err: unknown) {
      // Human delay
      await delay();

      if (err instanceof ArtificialError) {
        return err;
      }

      console.error(err);

      const errObj = err != null && typeof err === 'object' ? err : {};
      const errId =
        'id' in errObj && typeof (errObj as { id: unknown }).id === 'string' ? (errObj as { id: string }).id : '';
      const errMsg = err instanceof Error ? err.message : String(err);

      switch (true) {
        case ['delegate.unchanged', 'delegate.already_active'].some(errorLabel => errId.includes(errorLabel)):
          return new UnchangedError(errMsg);

        case errId.includes('unregistered_delegate'):
          return new UnregisteredDelegateError(errMsg);

        default:
          throw err;
      }
    }
  }, [balance, getEstimation, tezos.rpc, acc.type, acc.publicKeyHash, accountPkh]);

  const {
    data: baseFee,
    error: estimateBaseFeeError,
    isFetching: estimating
  } = useQuery({
    queryKey: feeKeys.delegateBase(tezos.checksum, accountPkh, toResolved),
    queryFn: estimateBaseFee,
    enabled: Boolean(toFilled),
    retry: false,
    staleTime: BLOCK_DURATION
  });
  const baseFeeError = baseFee instanceof Error ? baseFee : estimateBaseFeeError;

  const estimationError = !estimating ? baseFeeError : null;

  const { data: baker, isFetching: bakerValidating } = useKnownBaker(toResolved || null);

  const maxAddFee = useMemo(() => {
    if (baseFee instanceof BigNumber) {
      return new BigNumber(balanceNum).minus(baseFee).minus(PENNY).toNumber();
    }
    return undefined;
  }, [balanceNum, baseFee]);

  const fifoValidateDelegate = useMemo(
    () => fifoResolve((value: any) => validateDelegate(value, domainsClient, validateAddress)),
    [domainsClient]
  );

  const handleFeeFieldChange = useCallback<BakerFormProps['handleFeeFieldChange']>(
    ([v]) => (maxAddFee && v > maxAddFee ? maxAddFee : v),
    [maxAddFee]
  );

  const [submitError, setSubmitError] = useSafeState<ReactNode>(null, `${tezos.checksum}_${toResolved}`);
  const [operation, setOperation] = useSafeState<any>(null, tezos.checksum);

  useEffect(() => {
    if (operation && (!operation._operationResult.hasError || !operation._operationResult.isStopped)) {
      // navigate to success screen
      const hash = operation.hash || operation.opHash;

      const delegationBaseStateProps = {
        hash,
        assetSlug: MAV_TOKEN_SLUG,
        amount: atomsToTokens(balanceNum ?? 0, MAVEN_METADATA.decimals).toNumber(),
        oldValidatorAddress: myBakerPkh,
        validatorAddress: operation.to
      };

      if (unfamiliarWithDelegation) {
        navigate<SuccessStateType>('/success', undefined, {
          pageTitle: 'delegate',
          btnText: 'viewHistoryTab',
          btnLink: '?tab=history',
          contentId: 'DelegationOperation',
          contentIdFnProps: {
            ...delegationBaseStateProps,
            type: 'delegate'
          }
        });
      } else {
        navigate<SuccessStateType>('/success', undefined, {
          pageTitle: 'reDelegate',
          btnText: 'viewHistoryTab',
          btnLink: '?tab=history',
          contentId: 'DelegationOperation',
          contentIdFnProps: {
            ...delegationBaseStateProps,
            type: 'reDelegate'
          }
        });
      }
    }
  }, [balanceNum, isReDelegationActive, myBakerPkh, operation, unfamiliarWithDelegation, toResolved]);

  const onSubmit = useCallback(
    async ({ fee: feeVal }: FormData) => {
      const to = toResolved;
      if (formState.isSubmitting) return;
      setSubmitError(null);
      setOperation(null);

      const analyticsProperties = { bakerAddress: to };

      formAnalytics.trackSubmit(analyticsProperties);
      try {
        const estmtn = estimationRef.current ?? (await getEstimation());
        const addFee = tzToMumav(feeVal ?? 0);
        const fee = addFee.plus(estmtn.suggestedFeeMumav ?? 0).toNumber();
        let op: WalletOperation | TransactionOperation;
        let opHash = '';
        if (acc.type === TempleAccountType.ManagedKT) {
          const contract = await loadContract(tezos, acc.publicKeyHash);
          op = await contract.methods.do(setDelegate(to)).send({ amount: 0 });
        } else {
          op = await tezos.wallet
            .setDelegate({
              source: accountPkh,
              delegate: to,
              fee
            } as any)
            .send();

          opHash = op.opHash;
        }

        // create pending delegate operation
        const pendingOpObject = await buildPendingOperationObject({
          operation: op,
          type: 'delegation',
          sender: accountPkh,
          to,
          newDelegate: to,
          prevDelegate: myBakerPkh,
          estimation: estmtn
        });
        if (pendingOpObject) await putOperationIntoStorage(chainId, accountPkh, pendingOpObject);

        setOperation({ ...op, to });
        reset({ to: '', fee: RECOMMENDED_ADD_FEE });
        estimationRef.current = null;

        if (to === RECOMMENDED_BAKER_ADDRESS && opHash) {
          submitDelegation(opHash);
        }

        formAnalytics.trackSubmitSuccess(analyticsProperties);
      } catch (err: unknown) {
        formAnalytics.trackSubmitFail(analyticsProperties);

        if (err instanceof Error && err.message === 'Declined') {
          return;
        }

        console.error(err);

        // Human delay.
        await delay();
        setSubmitError(err instanceof Error ? err.message : String(err));
      }
    },
    [
      toResolved,
      formState.isSubmitting,
      setSubmitError,
      setOperation,
      formAnalytics,
      getEstimation,
      acc.type,
      acc.publicKeyHash,
      accountPkh,
      myBakerPkh,
      chainId,
      reset,
      tezos
    ]
  );

  const restFormDisplayed = Boolean(toFilled && (baseFee || estimationError));

  return (
    <div className={classNames(!restFormDisplayed && popup && 'pt-4 px-4', 'h-full flex-1 flex flex-col')}>
      {unfamiliarWithDelegation && isFromCoStakeNavigation && isStakeScreenWithBakersList && (
        <Alert
          type="info"
          title={<T id="attentionExclamation" />}
          className={classNames('mb-6')}
          description={<T id="coStakeAttentionMsg" />}
        />
      )}
      {!unfamiliarWithDelegation && myBakerPkh && !isReDelegationActive && (
        <AdvancedBakerBannerComponent bakerAddress={myBakerPkh} activateReDelegation={activateReDelegation} />
      )}
      {operation && <OperationStatus typeTitle={t('staking')} operation={operation} className="mb-8" />}
      {isReDelegationActive && (
        <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col flex-1">
          <Controller
            name="to"
            control={control}
            rules={{ validate: fifoValidateDelegate }}
            render={({ field: { ref: _ref, ...field } }) => (
              <NoSpaceField
                ref={toFieldRef}
                {...field}
                onChange={(v: any) => field.onChange(v)}
                onFocus={() => toFieldRef.current?.focus()}
                textarea
                rows={2}
                cleanable={Boolean(toValue)}
                onClean={cleanToField}
                id="delegate-to"
                label={isDcpNetwork ? t('producer') : t('delegateToValidator')}
                placeholder={canUseDomainNames ? t('enterPublicAddressPlaceholder') : t('bakerInputPlaceholder')}
                errorCaption={errors.to?.message && t(errors.to.message.toString() as TID)}
                style={{
                  resize: 'none'
                }}
                containerClassName={classNames('mb-4', toFilled && 'hidden')}
                testID={DelegateFormSelectors.bakerInput}
              />
            )}
          />

          {resolvedAddress && (
            <div className="mb-4 -mt-3 text-xs font-light text-gray-600 flex flex-wrap items-center">
              <span className="mr-1 whitespace-nowrap">{t('resolvedAddress')}:</span>
              <span className="font-normal">{resolvedAddress}</span>
            </div>
          )}

          <BakerForm
            baker={baker}
            submitError={submitError}
            estimationError={estimationError}
            estimating={estimating}
            baseFee={baseFee}
            toFilled={toFilled}
            bakerValidating={bakerValidating}
            control={control}
            errors={errors}
            handleFeeFieldChange={handleFeeFieldChange}
            setValue={setValue}
            trigger={trigger}
            formState={formState}
            restFormDisplayed={restFormDisplayed}
            toValue={toValue}
          />
        </form>
      )}
    </div>
  );
};

export default DelegateForm;

// Re-export components that were previously exported from this file
export { BakerBannerComponent } from './components/BakerBannerComponent';
export { AdvancedBakerBannerComponent } from './components/BakerBannerComponent';
export { DelegateActionsComponent } from './components/DelegateActionsComponent';
export { SortOptions } from './components/KnownDelegatorsList';
