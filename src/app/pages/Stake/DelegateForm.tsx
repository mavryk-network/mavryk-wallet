import React, { FC, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { DEFAULT_FEE, TransactionOperation, WalletOperation } from '@mavrykdynamics/taquito';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';
import { Control, Controller, FieldError, FormStateProxy, NestDataObject, useForm } from 'react-hook-form';

import { Alert, Anchor, Button, FormSubmitButton, HashChip, NoSpaceField } from 'app/atoms';
import { AlertWithAction } from 'app/atoms/AlertWithAction';
import Money from 'app/atoms/Money';
import Spinner from 'app/atoms/Spinner/Spinner';
import { ArtificialError, NotEnoughFundsError, ZeroBalanceError } from 'app/defaults';
import { useAppEnv } from 'app/env';
import AdditionalFeeInput from 'app/templates/AdditionalFeeInput/AdditionalFeeInput';
import BakerBanner from 'app/templates/BakerBanner';
import OperationStatus from 'app/templates/OperationStatus';
import { SortButton, SortListItemType, SortPopup, SortPopupContent } from 'app/templates/SortPopup';
import { useFormAnalytics } from 'lib/analytics';
import { submitDelegation } from 'lib/apis/everstake';
import { ABTestGroup } from 'lib/apis/temple';
import { useGasToken } from 'lib/assets/hooks';
import { useBalance } from 'lib/balances';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { TID, T, t } from 'lib/i18n';
import { setDelegate } from 'lib/michelson';
import { useTypedSWR } from 'lib/swr';
import { loadContract } from 'lib/temple/contract';
import {
  Baker,
  isDomainNameValid,
  useAccount,
  useKnownBaker,
  useKnownBakers,
  useTezos,
  useTezosDomainsClient,
  validateDelegate
} from 'lib/temple/front';
import { useTezosAddressByDomainName } from 'lib/temple/front/tzdns';
import { hasManager, isAddressValid, isKTAddress, mutezToTz, tzToMutez } from 'lib/temple/helpers';
import { TempleAccountType } from 'lib/temple/types';
import { useSafeState } from 'lib/ui/hooks';
import { delay, fifoResolve } from 'lib/utils';
import { navigate, useLocation } from 'lib/woozie';

import { useUserTestingGroupNameSelector } from '../../store/ab-testing/selectors';
import { SuccessStateType } from '../SuccessScreen/SuccessScreen';

import { DelegateFormSelectors } from './delegateForm.selectors';

const PENNY = 0.000001;
const RECOMMENDED_ADD_FEE = 0.0001;

interface FormData {
  to: string;
  fee: number;
}

export const RECOMMENDED_BAKER_ADDRESS = 'tz1aRoaRhSpRYvFdyvgWLL6TGyRoGF51wDjM';
export const HELP_UKRAINE_BAKER_ADDRESS = 'tz1bMFzs2aECPn4aCRmKQWHSLHF8ZnZbYcah';

type DelegateFormProps = {
  setToolbarRightSidedComponent: React.Dispatch<React.SetStateAction<JSX.Element | null>>;
};

const DelegateForm: FC<DelegateFormProps> = ({ setToolbarRightSidedComponent }) => {
  const { registerBackHandler } = useAppEnv();
  const formAnalytics = useFormAnalytics('DelegateForm');
  const { isDcpNetwork } = useGasToken();

  const { pathname } = useLocation();

  const acc = useAccount();
  const tezos = useTezos();

  const accountPkh = acc.publicKeyHash;

  const { value: balanceData } = useBalance('tez', accountPkh);
  const balance = balanceData!;
  const balanceNum = balance.toNumber();
  const domainsClient = useTezosDomainsClient();
  const canUseDomainNames = domainsClient.isSupported;

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
      <Anchor href="https://tezos-nodes.com/" className="text-base-plus text-accent-blue cursor-pointer">
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

  const estimateBaseFee = useCallback(async () => {
    try {
      if (balance.isZero()) {
        throw new ZeroBalanceError();
      }

      const estmtn = await getEstimation();
      const manager = await tezos.rpc.getManagerKey(
        acc.type === TempleAccountType.ManagedKT ? acc.publicKeyHash : accountPkh
      );
      let baseFee = mutezToTz(estmtn.burnFeeMumav + estmtn.suggestedFeeMumav);
      if (!hasManager(manager) && acc.type !== TempleAccountType.ManagedKT) {
        baseFee = baseFee.plus(mutezToTz(DEFAULT_FEE.REVEAL));
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
    async ({ fee: feeVal }: FormData) => {
      const to = toResolved;
      if (formState.isSubmitting) return;
      setSubmitError(null);
      setOperation(null);

      const analyticsProperties = { bakerAddress: to };

      formAnalytics.trackSubmit(analyticsProperties);
      try {
        const estmtn = await getEstimation();
        const addFee = tzToMutez(feeVal ?? 0);
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
      reset,
      tezos,
      accountPkh
    ]
  );

  const restFormDisplayed = Boolean(toFilled && (baseFee || estimationError));

  return (
    <div className={classNames(!restFormDisplayed && 'pt-4', 'h-full')}>
      {operation && <OperationStatus typeTitle={t('staking')} operation={operation} className="mb-8 px-4" />}

      <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">
        <Controller
          name="to"
          as={<NoSpaceField ref={toFieldRef} />}
          control={control}
          rules={{ validate: fifoValidateDelegate }}
          onChange={([v]) => v}
          onFocus={() => toFieldRef.current?.focus()}
          textarea
          rows={1}
          cleanable={Boolean(toValue)}
          onClean={cleanToField}
          id="delegate-to"
          label={isDcpNetwork ? t('producer') : t('delegateToValidator')}
          placeholder={canUseDomainNames ? t('enterPublicAddressPlaceholder') : t('bakerInputPlaceholder')}
          errorCaption={errors.to?.message && t(errors.to.message.toString() as TID)}
          style={{
            resize: 'none'
          }}
          containerClassName={classNames('px-4 mb-4', toFilled && 'hidden')}
          testID={DelegateFormSelectors.bakerInput}
        />

        {resolvedAddress && (
          <div className="mb-4 -mt-3 text-xs font-light text-gray-600 flex flex-wrap items-center px-4">
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
  UP_TIME = 'upTime'
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
  const testGroupName = useUserTestingGroupNameSelector();
  const assetSymbol = 'ꜩ';
  const estimateFallbackDisplayed = toFilled && !baseFee && (estimating || bakerValidating);

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

  return restFormDisplayed ? (
    <div className="flex-grow flex flex-col" style={{ marginTop: 2 }}>
      <BakerBannerComponent baker={baker} tzError={tzError} />
      <div className="mx-4 px-3 py-2 bg-primary-card rounded-lg mb-6">
        <HashChip hash={toValue} type="link" small trim={false} />
      </div>

      <div className={classNames('h-full px-4 flex flex-col flex-grow')}>
        <div className={classNames(!Boolean(tzError) && 'flex-grow')}>
          <AdditionalFeeInput
            name="fee"
            control={control}
            onChange={handleFeeFieldChange}
            assetSymbol={assetSymbol}
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
          disabled={Boolean(estimationError)}
          className="mt-6"
          testID={DelegateFormSelectors.bakerDelegateButton}
          testIDProperties={{
            message: bakerTestMessage
          }}
        >
          {t('stake')}
        </FormSubmitButton>
      </div>
    </div>
  ) : (
    <KnownDelegatorsList setValue={setValue} triggerValidation={triggerValidation} />
  );
};

interface BakerBannerComponentProps {
  baker: Baker | null | undefined;
  tzError: any;
}

export const BakerBannerComponent: React.FC<BakerBannerComponentProps> = ({ tzError, baker }) => {
  const acc = useAccount();

  const accountPkh = acc.publicKeyHash;
  const { value: balanceData } = useBalance('tez', accountPkh);
  const balance = balanceData!;
  const balanceNum = balance.toNumber();
  const { symbol } = useGasToken();
  return baker ? (
    <>
      <div className="flex flex-col items-center">
        <BakerBanner bakerPkh={baker.address} style={{ width: undefined }} />
      </div>

      {!tzError && baker.minDelegation > balanceNum && (
        <Alert
          type="warning"
          title={t('minDelegationAmountTitle')}
          description={
            <T
              id="minDelegationAmountDescription"
              substitutions={[
                <span className="font-normal" key="minDelegationsAmount">
                  <Money>{baker.minDelegation}</Money> <span style={{ fontSize: '0.75em' }}>{symbol}</span>
                </span>
              ]}
            />
          }
          className="mb-6"
        />
      )}
    </>
  ) : (
    <div className="p-4">
      <Alert type="warning" title={t('unknownBakerTitle')} description={t('unknownBakerDescription')} />
    </div>
  );
};

const KnownDelegatorsList: React.FC<{ setValue: any; triggerValidation: any }> = ({ setValue, triggerValidation }) => {
  const knownBakers = useKnownBakers();
  const testGroupName = useUserTestingGroupNameSelector();

  const [sortOption, setSortOption] = useState<SortOptions>(SortOptions.AVAILABLE_SPACE);

  const memoizedSortAssetsOptions: SortListItemType[] = useMemo(
    () => [
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
      },
      {
        id: SortOptions.UP_TIME,
        selected: sortOption === SortOptions.UP_TIME,
        onClick: () => setSortOption(SortOptions.UP_TIME),
        nameI18nKey: 'upTime'
      }
    ],
    [sortOption]
  );

  const baseSortedKnownBakers = useMemo(() => {
    if (!knownBakers) return null;

    const toSort = Array.from(knownBakers);
    switch (sortOption) {
      case SortOptions.AVAILABLE_SPACE:
        return toSort.sort((a, b) => b.freeSpace - a.freeSpace);

      case SortOptions.FEE:
        return toSort.sort((a, b) => a.fee - b.fee);

      case SortOptions.UP_TIME:
        return toSort.sort((a, b) => b.estimatedRoi - a.estimatedRoi);

      default:
        return toSort;
    }
  }, [knownBakers, sortOption]);

  if (!baseSortedKnownBakers) return null;
  const sponsoredBakers = baseSortedKnownBakers.filter(
    baker => baker.address === RECOMMENDED_BAKER_ADDRESS || baker.address === HELP_UKRAINE_BAKER_ADDRESS
  );
  const sortedKnownBakers = [
    ...sponsoredBakers,
    ...baseSortedKnownBakers.filter(
      baker => baker.address !== RECOMMENDED_BAKER_ADDRESS && baker.address !== HELP_UKRAINE_BAKER_ADDRESS
    )
  ];

  return (
    <div className="flex flex-col">
      <h2 className=" w-full mb-4 -mt-2 leading-tight flex items-center justify-between px-4">
        <span className="text-base-plus text-white">
          <T id="delegateToPromotedValidators" />
        </span>

        <SortPopup>
          <SortButton className="-mr-1" />
          <SortPopupContent items={memoizedSortAssetsOptions} />
        </SortPopup>
      </h2>

      <div className="px-4">
        <AlertWithAction btnLabel={t('promote')}>
          <T id="promoteYourself" />
        </AlertWithAction>
      </div>

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
