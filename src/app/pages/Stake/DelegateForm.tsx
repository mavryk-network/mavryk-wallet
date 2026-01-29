import React, { FC, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_FEE, TransactionOperation, WalletOperation } from '@mavrykdynamics/webmavryk';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';
import { Control, Controller, FieldError, FormStateProxy, NestDataObject, useForm } from 'react-hook-form';

import { Alert, Anchor, Button, Divider, FormSubmitButton, HashChip, NoSpaceField } from 'app/atoms';
import Money from 'app/atoms/Money';
import Spinner from 'app/atoms/Spinner/Spinner';
import { ArtificialError, NotEnoughFundsError, ZeroBalanceError } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { ReactComponent as ExternalLinkIcon } from 'app/icons/external-link.svg';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { AdditionalFeeInput } from 'app/templates/AdditionalFeeInput/AdditionalFeeInput';
import BakerBanner from 'app/templates/BakerBanner';
import OperationStatus from 'app/templates/OperationStatus';
import { SortButton, SortListItemType, SortPopup, SortPopupContent } from 'app/templates/SortPopup';
import { useFormAnalytics } from 'lib/analytics';
import { submitDelegation } from 'lib/apis/everstake';
import { ABTestGroup } from 'lib/apis/temple';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useGasToken } from 'lib/assets/hooks';
import { useBalance } from 'lib/balances';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { TID, T, t } from 'lib/i18n';
import { HELP_UKRAINE_BAKER_ADDRESS, RECOMMENDED_BAKER_ADDRESS } from 'lib/known-bakers';
import { MAVEN_METADATA } from 'lib/metadata';
import { setDelegate } from 'lib/michelson';
import { useTypedSWR } from 'lib/swr';
import { loadContract } from 'lib/temple/contract';
import {
  Baker,
  isDomainNameValid,
  useAccount,
  useChainId,
  useDelegate,
  useKnownBaker,
  useKnownBakers,
  useTezos,
  useTezosDomainsClient,
  validateDelegate
} from 'lib/temple/front';
import { useAccountDelegatePeriodStats } from 'lib/temple/front/baking';
import {
  CO_STAKE,
  FINALIZE_UNLOCK,
  MANAGE_STAKE,
  SORTED_PREDEFINED_SPONSORED_BAKERS,
  UNLOCK_STAKE,
  UNLOCKING
} from 'lib/temple/front/baking/const';
import { calculateCapacities } from 'lib/temple/front/baking/utils';
import { getDelegateLabel } from 'lib/temple/front/baking/utils/label';
import { useTezosAddressByDomainName } from 'lib/temple/front/tzdns';
import { atomsToTokens, hasManager, isAddressValid, isKTAddress, mumavToTz, tzToMumav } from 'lib/temple/helpers';
import { buildPendingOperationObject, putOperationIntoStorage } from 'lib/temple/history/utils';
import { TempleAccountType } from 'lib/temple/types';
import { useSafeState } from 'lib/ui/hooks';
import { delay, fifoResolve } from 'lib/utils';
import { ZERO } from 'lib/utils/numbers';
import { navigate, useLocation } from 'lib/woozie';

import { useUserTestingGroupNameSelector } from '../../store/ab-testing/selectors';
import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

import { DelegateFormSelectors } from './delegateForm.selectors';
import { RedelegatePopup } from './popups/Redelegate.popup';
import { UnlockPopup } from './popups/Unlock.popup';
import { UnlockFisrtPopup } from './popups/UnlockFirst.popup';

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
  avtivateReDelegation: () => void;
  setToolbarRightSidedComponent: React.Dispatch<React.SetStateAction<JSX.Element | null>>;
};

const DelegateForm: FC<DelegateFormProps> = ({
  setToolbarRightSidedComponent,
  unfamiliarWithDelegation,
  isFromCoStakeNavigation,
  isReDelegationActive,
  avtivateReDelegation
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
  const balance = balanceData!;
  const balanceNum = balance.toNumber();
  const domainsClient = useTezosDomainsClient();
  const canUseDomainNames = domainsClient.isSupported;
  const chainId = useChainId();

  /**
   * Form
   */

  const { watch, handleSubmit, errors, control, formState, setValue, triggerValidation, reset } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      fee: RECOMMENDED_ADD_FEE
    }
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
    } catch (err: any) {
      // Human delay
      await delay();

      if (err instanceof ArtificialError) {
        return err;
      }

      console.error(err);

      switch (true) {
        case ['delegate.unchanged', 'delegate.already_active'].some(errorLabel => err?.id.includes(errorLabel)):
          return new UnchangedError(err.message);

        case err?.id.includes('unregistered_delegate'):
          return new UnregisteredDelegateError(err.message);

        default:
          throw err;
      }
    }
  }, [balance, getEstimation, tezos.rpc, acc.type, acc.publicKeyHash, accountPkh]);

  const {
    data: baseFee,
    error: estimateBaseFeeError,
    isValidating: estimating
  } = useTypedSWR(
    () => (toFilled ? ['delegate-base-fee', tezos.checksum, accountPkh, toResolved] : null),
    estimateBaseFee,
    {
      shouldRetryOnError: false,
      focusThrottleInterval: 10_000,
      dedupingInterval: BLOCK_DURATION
    }
  );
  const baseFeeError = baseFee instanceof Error ? baseFee : estimateBaseFeeError;

  const estimationError = !estimating ? baseFeeError : null;

  const { data: baker, isValidating: bakerValidating } = useKnownBaker(toResolved || null, false);

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
        validatorAddress: myBakerPkh
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
  }, [balanceNum, isReDelegationActive, myBakerPkh, operation, unfamiliarWithDelegation]);

  const onSubmit = useCallback(
    async ({ fee: feeVal }: FormData) => {
      const to = toResolved;
      if (formState.isSubmitting) return;
      setSubmitError(null);
      setOperation(null);

      const analyticsProperties = { bakerAddress: to };

      formAnalytics.trackSubmit(analyticsProperties);
      try {
        const estmtn = await getEstimation();
        const addFee = tzToMumav(feeVal ?? 0);
        const fee = addFee.plus(estmtn.suggestedFeeMumav).toNumber();
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

        setOperation(op);
        reset({ to: '', fee: RECOMMENDED_ADD_FEE });

        if (to === RECOMMENDED_BAKER_ADDRESS && opHash) {
          submitDelegation(opHash);
        }

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
        <AdvancedBakerBannerComponent bakerAddress={myBakerPkh} avtivateReDelegation={avtivateReDelegation} />
      )}
      {operation && <OperationStatus typeTitle={t('staking')} operation={operation} className="mb-8" />}
      {isReDelegationActive && (
        <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col flex-1">
          <Controller
            name="to"
            as={<NoSpaceField ref={toFieldRef} />}
            control={control}
            rules={{ validate: fifoValidateDelegate }}
            onChange={([v]) => v}
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
            triggerValidation={triggerValidation}
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

interface BakerFormProps {
  baker: Baker | null | undefined;
  toFilled: boolean | '';
  submitError: ReactNode;
  estimationError: any;
  estimating: boolean;
  bakerValidating: boolean;
  restFormDisplayed: boolean;
  toValue: string;
  baseFee?: BigNumber | ArtificialError | UnchangedError | UnregisteredDelegateError;
  control: Control<FormData>;
  handleFeeFieldChange: ([v]: any) => any;
  errors: NestDataObject<FormData, FieldError>;
  setValue: any;
  triggerValidation: (payload?: string | string[] | undefined, shouldRender?: boolean | undefined) => Promise<boolean>;
  formState: FormStateProxy<FormData>;
}

export enum SortOptions {
  AVAILABLE_SPACE = 'availableSpace',
  FEE = 'fee',
  DEFAULT = 'default'
}

const BakerForm: React.FC<BakerFormProps> = ({
  baker,
  submitError,
  estimationError,
  estimating,
  bakerValidating,
  toFilled,
  baseFee,
  control,
  errors,
  handleFeeFieldChange,
  setValue,
  triggerValidation,
  formState,
  restFormDisplayed,
  toValue
}) => {
  const { popup } = useAppEnv();
  const testGroupName = useUserTestingGroupNameSelector();
  const estimateFallbackDisplayed = toFilled && !baseFee && (estimating || bakerValidating);
  const memoizedBakerStyles = useMemo(() => ({ ...(!popup ? { paddingInline: 0, paddingTop: 0 } : {}) }), [popup]);

  const acc = useAccount();
  const accountPkh = acc.publicKeyHash;

  const { rawValue } = useBalance(MAV_TOKEN_SLUG, accountPkh);

  const { delegatedFreeSpace } = useMemo(() => {
    const { stakedBalance, delegatedBalance, externalStakedBalance } = baker ?? {
      stakedBalance: 0,
      delegatedBalance: 0,
      externalStakedBalance: 0
    };
    return calculateCapacities({ stakedBalance, delegatedBalance, externalStakedBalance });
  }, [baker]);

  const bakerTestMessage = useMemo(() => {
    if (baker?.address !== RECOMMENDED_BAKER_ADDRESS) {
      return 'Unknown Delegate Button';
    }

    if (testGroupName === ABTestGroup.B) {
      return 'Known B Delegate Button';
    }

    return 'Known A Delegate Button';
  }, [baker?.address, RECOMMENDED_BAKER_ADDRESS]);

  if (estimateFallbackDisplayed) {
    return (
      <div className="flex justify-center my-8">
        <Spinner className="w-20" />
      </div>
    );
  }
  const tzError = submitError || estimationError;
  const hasLowBalance = new BigNumber(rawValue ?? 0).isLessThan(baker?.minDelegation ?? 0);
  const isBakerOverDelegated = delegatedFreeSpace < 0;
  const isDelegateBtnDisabled = Boolean(estimationError) || hasLowBalance || isBakerOverDelegated;

  return restFormDisplayed ? (
    <div className="flex-grow flex flex-col mt-2">
      <BakerBannerComponent baker={baker} tzError={tzError} style={memoizedBakerStyles} />
      <div className={classNames('px-3 py-2 bg-primary-card rounded-lg mb-6', popup && 'mx-4')}>
        <HashChip hash={toValue} type="link" small trim={false} />
      </div>

      <div className={classNames('h-full flex flex-col flex-grow', popup && 'px-4')}>
        <div className={classNames(!Boolean(tzError) && 'flex-grow')}>
          <AdditionalFeeInput
            name="fee"
            control={control}
            onChange={handleFeeFieldChange}
            assetSymbol={MAVEN_METADATA.symbol}
            baseFee={baseFee}
            error={errors.fee}
            id="delegate-fee"
          />
        </div>

        {tzError && (
          <div className="flex-grow flex items-start">
            <DelegateErrorAlert type={submitError ? 'submit' : 'estimation'} error={tzError} />
          </div>
        )}

        <FormSubmitButton
          loading={formState.isSubmitting}
          disabled={isDelegateBtnDisabled}
          className="mt-6"
          testID={DelegateFormSelectors.bakerDelegateButton}
          testIDProperties={{
            message: bakerTestMessage
          }}
        >
          {t('delegate')}
        </FormSubmitButton>
      </div>
    </div>
  ) : (
    <KnownDelegatorsList setValue={setValue} triggerValidation={triggerValidation} />
  );
};

// BANNERS --------------------------------
interface BakerBannerComponentProps {
  baker: Baker | null | undefined;
  tzError: any;
  style?: React.CSSProperties;
}

export const BakerBannerComponent: React.FC<BakerBannerComponentProps> = ({ tzError, baker, style }) => {
  const { popup } = useAppEnv();
  const acc = useAccount();

  const accountPkh = acc.publicKeyHash;
  const { rawValue } = useBalance(MAV_TOKEN_SLUG, accountPkh);
  const { metadata } = useGasToken();

  return baker ? (
    <>
      <div className="flex flex-col items-center">
        <BakerBanner bakerPkh={baker.address} style={{ width: undefined, ...style }} />
      </div>
      {!tzError && new BigNumber(rawValue ?? 0).isLessThan(baker.minDelegation ?? 0) && (
        <div className={classNames('pb-6', popup && 'px-4')}>
          <Alert
            type="info"
            title={t('minDelegationAmountTitle')}
            description={
              <T
                id="minDelegationAmountDescription"
                substitutions={[
                  <span className="font-normal" key="minDelegationsAmount">
                    <Money>{atomsToTokens(baker.minDelegation || ZERO, metadata.decimals)}</Money>{' '}
                    <span>{metadata.symbol}</span>
                  </span>
                ]}
              />
            }
            className={classNames('mt-6')}
          />
        </div>
      )}
    </>
  ) : null;
};

export const DelegateActionsComponent: FC<{ avtivateReDelegation: () => void }> = ({ avtivateReDelegation }) => {
  const [opened, setOpened] = useState({
    redelegate: false,
    unlock: false,
    firstUnlock: false
  });
  const account = useAccount();
  const chainId = useChainId();
  const tezos = useTezos();
  const { data } = useAccountDelegatePeriodStats(account.publicKeyHash);
  const { canRedelegate, canCostake, canUnlock, stakedBalance, unstakedBalance, myBakerPkh } = data;
  const delegateLabel = getDelegateLabel(data);
  const hasZeroStakingBalance = stakedBalance === 0 && unstakedBalance === 0;

  const isWatchOnlyAccount = account.type === TempleAccountType.WatchOnly;

  const close = useCallback((key: keyof typeof opened) => {
    setOpened(prev => ({ ...prev, [key]: false }));
  }, []);

  const open = useCallback((key: keyof typeof opened) => {
    setOpened(prev => ({ ...prev, [key]: true }));
  }, []);

  const handleReDelegateNavigation = useCallback(() => {
    avtivateReDelegation();
    close('redelegate');
  }, [avtivateReDelegation, close]);

  const handleDelegateClickbasedOnPeriod = useCallback(async () => {
    if (hasZeroStakingBalance && delegateLabel === CO_STAKE) {
      return navigate('/co-stake');
    }

    if (delegateLabel === CO_STAKE) {
      return navigate('/manage-stake?tab=stake');
    } else if (delegateLabel === UNLOCK_STAKE) {
      return navigate('/manage-stake?tab=stake');
    }

    if (delegateLabel === FINALIZE_UNLOCK) {
      try {
        const estmtn = await tezos.estimate.finalizeUnstake({});
        const op = await tezos.wallet.finalizeUnstake({}).send();

        // create pending delegate operation
        const pendingOpObject = await buildPendingOperationObject({
          operation: op,
          type: 'staking',
          sender: account.publicKeyHash,
          estimation: estmtn,
          baker: myBakerPkh,
          kind: 'finalize_unstake'
        });
        if (pendingOpObject) await putOperationIntoStorage(chainId, account.publicKeyHash, pendingOpObject);

        return navigate<SuccessStateType>('/success', undefined, {
          pageTitle: 'finalizeUnlock',
          btnText: 'viewHistoryTab',
          btnLink: '?tab=history',
          contentId: 'DelegationOperation',
          contentIdFnProps: {
            hash: pendingOpObject?.hash,
            assetSlug: MAV_TOKEN_SLUG,
            amount: atomsToTokens(unstakedBalance ?? 0, MAVEN_METADATA.decimals).toNumber(),
            validatorAddress: myBakerPkh,
            type: 'finalize'
          }
        });
      } catch (error) {
        console.log(error);
      }
    }

    if (delegateLabel === UNLOCKING) {
      return;
    }
  }, [
    account.publicKeyHash,
    chainId,
    delegateLabel,
    hasZeroStakingBalance,
    myBakerPkh,
    tezos.estimate,
    tezos.wallet,
    unstakedBalance
  ]);

  const isStakeButtonDisabled = useMemo(() => {
    switch (delegateLabel) {
      case CO_STAKE:
        return !canCostake;
      case UNLOCK_STAKE:
        return !canUnlock;
      case UNLOCKING:
        return true;
      case FINALIZE_UNLOCK:
        return false;
      default:
        return false;
    }
  }, [canCostake, canUnlock, delegateLabel]);

  const handleRedelegateClick = useCallback(() => {
    if (!canRedelegate) return;
    if (delegateLabel === UNLOCK_STAKE) {
      open('firstUnlock');
    } else {
      open('redelegate');
    }
  }, [delegateLabel, open, canRedelegate]);

  const delegationLabelToShow = useMemo(() => {
    return (delegateLabel === CO_STAKE || delegateLabel === UNLOCK_STAKE) && !hasZeroStakingBalance
      ? MANAGE_STAKE
      : delegateLabel;
  }, [delegateLabel, hasZeroStakingBalance]);

  if (isWatchOnlyAccount) return null;

  return (
    <div className="grid gap-3 grid-cols-2">
      <ButtonRounded
        size="xs"
        fill={false}
        onClick={handleRedelegateClick}
        disabled={isWatchOnlyAccount || !canRedelegate}
      >
        <T id="reDelegate" />
      </ButtonRounded>
      <ButtonRounded
        size="xs"
        fill
        onClick={handleDelegateClickbasedOnPeriod}
        disabled={isWatchOnlyAccount || isStakeButtonDisabled}
      >
        {delegationLabelToShow}
      </ButtonRounded>

      <RedelegatePopup
        opened={opened.redelegate}
        close={close.bind(null, 'redelegate')}
        handleReDelegateNavigation={handleReDelegateNavigation}
      />
      <UnlockPopup opened={opened.unlock} close={close.bind(null, 'unlock')} />
      <UnlockFisrtPopup opened={opened.firstUnlock} close={close.bind(null, 'firstUnlock')} />
    </div>
  );
};

export const AdvancedBakerBannerComponent: React.FC<{
  bakerAddress: string;
  avtivateReDelegation: () => void;
}> = ({ bakerAddress, avtivateReDelegation }) => {
  const { data: baker } = useKnownBaker(bakerAddress || null, false);

  return baker ? (
    <div>
      <p className="text-white text-base">My Validator</p>
      <div className="flex items-center py-4">
        <BakerBanner bakerPkh={baker.address} style={{ padding: 0 }} />
        <Anchor href={`${process.env.NODES_URL}/validator/${baker.address}`}>
          <ExternalLinkIcon className="w-6 h-6 text-white fill-current" />
        </Anchor>
      </div>
      <DelegateActionsComponent avtivateReDelegation={avtivateReDelegation} />
      <Divider className="my-6" color="bg-divider" ignoreParent />
    </div>
  ) : null;
};

// LIST --------------------------------
type KnownDelegatorsListProps = {
  setValue: any;
  triggerValidation: (payload?: string | string[] | undefined, shouldRender?: boolean | undefined) => Promise<boolean>;
};

const KnownDelegatorsList: React.FC<KnownDelegatorsListProps> = ({ setValue, triggerValidation }) => {
  const knownBakers = useKnownBakers();
  const acc = useAccount();

  const accountPkh = acc.publicKeyHash;

  const { data: accStats } = useDelegate(accountPkh);
  const myBakerPkh = accStats?.delegate?.address ?? '';

  const testGroupName = useUserTestingGroupNameSelector();
  const { popup } = useAppEnv();

  const [sortOption, setSortOption] = useState<SortOptions>(SortOptions.DEFAULT);

  const memoizedSortAssetsOptions: SortListItemType[] = useMemo(
    () => [
      {
        id: SortOptions.DEFAULT,
        selected: sortOption === SortOptions.DEFAULT,
        onClick: () => setSortOption(SortOptions.DEFAULT),
        nameI18nKey: 'default'
      },
      {
        id: SortOptions.AVAILABLE_SPACE,
        selected: sortOption === SortOptions.AVAILABLE_SPACE,
        onClick: () => {
          setSortOption(SortOptions.AVAILABLE_SPACE);
        },
        nameI18nKey: 'availableSpace'
      },
      {
        id: SortOptions.FEE,
        selected: sortOption === SortOptions.FEE,
        onClick: () => setSortOption(SortOptions.FEE),
        nameI18nKey: 'fee'
      }
    ],
    [sortOption]
  );

  const baseSortedKnownBakers = useMemo(() => {
    if (!knownBakers) return null;

    const toSort = Array.from(knownBakers);

    switch (sortOption) {
      case SortOptions.AVAILABLE_SPACE:
        return toSort.sort((a, b) => (b.freeSpace ?? 0) - (a.freeSpace ?? 0));

      case SortOptions.FEE:
        return toSort.sort((a, b) => (b.fee ?? 0) - (a.fee ?? 0));

      case SortOptions.DEFAULT:
      default:
        // SORTED_PREDEFINED_SPONSORED_BAKERS
        return toSort.sort((a, b) => {
          const { totalFreSpace: aTotalFreeSpace, totalCapacity: aTotalCapacity } = calculateCapacities({
            stakedBalance: a.stakedBalance,
            delegatedBalance: a.delegatedBalance,
            externalStakedBalance: a.externalStakedBalance
          });

          const { totalFreSpace: bTotalFreeSpace, totalCapacity: bTotalCapacity } = calculateCapacities({
            stakedBalance: b.stakedBalance,
            delegatedBalance: b.delegatedBalance,
            externalStakedBalance: b.externalStakedBalance
          });

          const aTotalFreeSpacePercent = aTotalCapacity > 0 ? (aTotalFreeSpace / aTotalCapacity) * 100 : 0;

          const bTotalFreeSpacePercent = bTotalCapacity > 0 ? (bTotalFreeSpace / bTotalCapacity) * 100 : 0;

          return bTotalFreeSpacePercent - aTotalFreeSpacePercent;
        });
    }
  }, [knownBakers, sortOption]);

  if (!baseSortedKnownBakers) return null;

  const sponsoredBakers = baseSortedKnownBakers.filter(
    baker => baker.address === RECOMMENDED_BAKER_ADDRESS || baker.address === HELP_UKRAINE_BAKER_ADDRESS
  );

  const sortedKnownBakers = [
    ...sponsoredBakers,
    ...baseSortedKnownBakers.filter(
      baker =>
        baker.address !== RECOMMENDED_BAKER_ADDRESS &&
        baker.address !== HELP_UKRAINE_BAKER_ADDRESS &&
        baker.address !== myBakerPkh
    )
  ];

  return (
    <div className="flex flex-col">
      <h2 className=" w-full mb-4 -mt-2 leading-tight flex items-center justify-between">
        <span className="text-base-plus text-white">
          <T id="delegateToPromotedValidators" />
        </span>

        <SortPopup>
          <SortButton className="-mr-1" />
          <SortPopupContent items={memoizedSortAssetsOptions} alternativeLogic={!popup} />
        </SortPopup>
      </h2>

      {/* <div>
        <AlertWithAction btnLabel={t('promote')}>
          <T id="promoteYourself" />
        </AlertWithAction>
      </div> */}

      <div className="flex flex-col overflow-hidden text-white text-sm mt-1">
        {sortedKnownBakers.map((baker, i, arr) => {
          const last = i === arr.length - 1;
          const handleBakerClick = () => {
            setValue('to', baker.address);
            triggerValidation('to');
            window.scrollTo(0, 0);
            navigate(`/stake/${baker.address}`);
          };

          let testId = DelegateFormSelectors.knownBakerItemButton;
          let classnames = classNames(
            'hover:bg-primary-card',
            'transition ease-in-out duration-200',
            'focus:outline-none'
          );

          if (baker.address === RECOMMENDED_BAKER_ADDRESS) {
            testId = DelegateFormSelectors.knownBakerItemAButton;
            if (testGroupName === ABTestGroup.B) {
              testId = DelegateFormSelectors.knownBakerItemBButton;
              classnames = classNames(
                'hover:bg-primary-card',
                'transition ease-in-out duration-200',
                'focus:outline-none',
                'opacity-90 hover:opacity-100'
              );
            }
          }

          return (
            <Button
              key={baker.address}
              type="button"
              className={classnames}
              onClick={handleBakerClick}
              testID={testId}
              testIDProperties={{ bakerAddress: baker.address, abTestingCategory: testGroupName }}
            >
              <BakerBanner
                bakerPkh={baker.address}
                link
                style={{ width: undefined }}
                className={classNames(!last && 'border-b border-divider')}
              />
            </Button>
          );
        })}
      </div>
    </div>
  );
};

type DelegateErrorAlertProps = {
  type: 'submit' | 'estimation';
  error: Error;
};

// ALERT --------------------------------
const DelegateErrorAlert: FC<DelegateErrorAlertProps> = ({ type, error }) => {
  const { symbol } = useGasToken();

  return (
    <Alert
      type={type === 'submit' ? 'error' : 'warning'}
      title={(() => {
        switch (true) {
          case error instanceof NotEnoughFundsError:
            return `${t('notEnoughFunds')} 😶`;

          case [UnchangedError, UnregisteredDelegateError].some(Err => error instanceof Err):
            return t('notAllowed');

          default:
            return t('failed');
        }
      })()}
      description={(() => {
        switch (true) {
          case error instanceof ZeroBalanceError:
            return t('yourBalanceIsZero');

          case error instanceof NotEnoughFundsError:
            return t('minimalFeeGreaterThanBalance');

          case error instanceof UnchangedError:
            return t('alreadyDelegatedFundsToBaker');

          case error instanceof UnregisteredDelegateError:
            return t('bakerNotRegistered');

          default:
            return (
              <>
                <T
                  id="unableToPerformActionToBaker"
                  substitutions={t(type === 'submit' ? 'delegate' : 'estimateDelegation').toLowerCase()}
                />

                <br />

                <T id="thisMayHappenBecause" />

                <ul className="mt-1 ml-2 text-xs list-disc list-inside">
                  <li>
                    <T id="minimalFeeGreaterThanBalanceVerbose" substitutions={symbol} />
                  </li>

                  <li>
                    <T id="networkOrOtherIssue" />
                  </li>
                </ul>
              </>
            );
        }
      })()}
      autoFocus
      className="my-6"
    />
  );
};

class UnchangedError extends Error {}

class UnregisteredDelegateError extends Error {}

function validateAddress(value: string) {
  switch (false) {
    case value?.length > 0:
      return true;

    case isAddressValid(value):
      return 'invalidAddress';

    case !isKTAddress(value):
      return 'unableToDelegateToKTAddress';

    default:
      return true;
  }
}
