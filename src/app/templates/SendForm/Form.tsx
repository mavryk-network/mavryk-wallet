import React, {
  Dispatch,
  FC,
  FocusEventHandler,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  DEFAULT_FEE,
  TransferParams,
  Estimate,
  TransactionWalletOperation,
  TransactionOperation
} from '@mavrykdynamics/taquito';
import { ManagerKeyResponse } from '@mavrykdynamics/taquito-rpc';
import BigNumber from 'bignumber.js';
import clsx from 'clsx';
import { Controller, FieldError, useForm } from 'react-hook-form';

import { FormSubmitButton, Money, NoSpaceField } from 'app/atoms';
import AssetField from 'app/atoms/AssetField';
import { ArtificialError, NotEnoughFundsError, ZeroBalanceError, ZeroTEZBalanceError } from 'app/defaults';
import { useAppEnv } from 'app/env';
import InFiat from 'app/templates/InFiat';
import { useFormAnalytics } from 'lib/analytics';
import { isTezAsset, MAV_TOKEN_SLUG, toPenny } from 'lib/assets';
import { toTransferParams } from 'lib/assets/contract.utils';
import { useBalance } from 'lib/balances';
import { useAssetFiatCurrencyPrice, useFiatCurrency } from 'lib/fiat-currency';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { toLocalFixed, T, t } from 'lib/i18n';
import { AssetMetadataBase, useAssetMetadata, getAssetSymbol } from 'lib/metadata';
import { transferImplicit, transferToContract } from 'lib/michelson';
import { useTypedSWR } from 'lib/swr';
import { loadContract } from 'lib/temple/contract';
import {
  ReactiveTezosToolkit,
  isDomainNameValid,
  useAccount,
  useNetwork,
  useTezos,
  useTezosDomainsClient,
  useFilteredContacts,
  validateRecipient
} from 'lib/temple/front';
import { useTezosAddressByDomainName } from 'lib/temple/front/tzdns';
import { hasManager, isAddressValid, isKTAddress, mumavToTz, tzToMumav } from 'lib/temple/helpers';
import { TempleAccountType, TempleAccount, TempleNetworkType } from 'lib/temple/types';
import { useSafeState } from 'lib/ui/hooks';
import { useScrollIntoView } from 'lib/ui/use-scroll-into-view';
import { delay } from 'lib/utils';

import ContactsDropdown, { ContactsDropdownProps } from './ContactsDropdown';
import { ContactsDropdownItemSecondary } from './ContactsDropdownItem';
import { FeeSection } from './FeeSection';
import { SendFormSelectors } from './selectors';
import { SpinnerSection } from './SpinnerSection';
import { useAddressFieldAnalytics } from './use-address-field-analytics';

interface FormData {
  to: string;
  amount: string;
  fee: number;
}

const PENNY = 0.000001;
const RECOMMENDED_ADD_FEE = 0.0001;
const amountStyle = {
  resize: 'none',
  height: 66,
  position: 'relative'
};

type FormProps = {
  assetSlug: string;
  setOperation: Dispatch<any>;
  onAddContactRequested: (address: string) => void;
};

export const Form: FC<FormProps> = ({ assetSlug, setOperation, onAddContactRequested }) => {
  const { registerBackHandler } = useAppEnv();

  const assetMetadata = useAssetMetadata(assetSlug);
  const assetPrice = useAssetFiatCurrencyPrice(assetSlug);

  const assetSymbol = useMemo(() => getAssetSymbol(assetMetadata), [assetMetadata]);

  const { allContacts } = useFilteredContacts();
  const network = useNetwork();
  const acc = useAccount();
  const tezos = useTezos();
  const domainsClient = useTezosDomainsClient();
  const { popup } = useAppEnv();

  const formAnalytics = useFormAnalytics('SendForm');

  // const canUseDomainNames = domainsClient.isSupported;
  const accountPkh = acc.publicKeyHash;

  const { value: balanceData } = useBalance(assetSlug, accountPkh);
  const balance = balanceData!;

  const { value: tezBalanceData } = useBalance(MAV_TOKEN_SLUG, accountPkh);
  const tezBalance = tezBalanceData!;

  const [shoudUseFiat, setShouldUseFiat] = useSafeState(false);

  const canToggleFiat = getAssetPriceByNetwork(network.type, assetPrice.toNumber());
  const prevCanToggleFiat = useRef(canToggleFiat);

  /**
   * Form
   */

  const { watch, handleSubmit, errors, control, formState, setValue, triggerValidation, reset } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      fee: RECOMMENDED_ADD_FEE
    }
  });

  // const handleFiatToggle = useCallback(
  //   (evt: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
  //     evt.preventDefault();

  //     const newShouldUseFiat = !shoudUseFiat;
  //     setShouldUseFiat(newShouldUseFiat);
  //     if (!getValues().amount) {
  //       return;
  //     }
  //     const amount = new BigNumber(getValues().amount);
  //     setValue(
  //       'amount',
  //       (newShouldUseFiat ? amount.multipliedBy(assetPrice) : amount.div(assetPrice)).toFormat(
  //         newShouldUseFiat ? 2 : 6,
  //         BigNumber.ROUND_FLOOR,
  //         {
  //           decimalSeparator: '.'
  //         }
  //       )
  //     );
  //   },
  //   [setShouldUseFiat, shoudUseFiat, getValues, assetPrice, setValue]
  // );

  useEffect(() => {
    if (!canToggleFiat && prevCanToggleFiat.current && shoudUseFiat) {
      setShouldUseFiat(false);
      setValue('amount', undefined);
    }
    prevCanToggleFiat.current = canToggleFiat;
  }, [setShouldUseFiat, canToggleFiat, shoudUseFiat, setValue]);

  const toValue = watch('to');
  const amountValue = watch('amount');
  const feeValue = watch('fee') ?? RECOMMENDED_ADD_FEE;

  const amountFieldRef = useRef<HTMLInputElement>(null);

  const { onBlur } = useAddressFieldAnalytics(toValue, 'RECIPIENT_NETWORK');

  const toFilledWithAddress = useMemo(() => Boolean(toValue && isAddressValid(toValue)), [toValue]);

  const toFilledWithDomain = useMemo(
    () => toValue && isDomainNameValid(toValue, domainsClient),
    [toValue, domainsClient]
  );

  const { data: resolvedAddress } = useTezosAddressByDomainName(toValue);

  const toFilled = useMemo(
    () => (resolvedAddress ? toFilledWithDomain : toFilledWithAddress),
    [toFilledWithAddress, toFilledWithDomain, resolvedAddress]
  );

  const toResolved = useMemo(() => resolvedAddress || toValue, [resolvedAddress, toValue]);

  const toFilledWithKTAddress = useMemo(() => isAddressValid(toResolved) && isKTAddress(toResolved), [toResolved]);

  const filledContact = useMemo(
    () => (toResolved && allContacts.find(c => c.address === toResolved)) || null,
    [allContacts, toResolved]
  );

  const cleanToField = useCallback(() => {
    setValue('to', '');
    triggerValidation('to');
  }, [setValue, triggerValidation]);

  const toFieldRef = useScrollIntoView<HTMLTextAreaElement>(Boolean(toFilled), { block: 'center' });

  useLayoutEffect(() => {
    if (toFilled) {
      return registerBackHandler(() => {
        cleanToField();
        window.scrollTo(0, 0);
      });
    }
    return undefined;
  }, [toFilled, registerBackHandler, cleanToField]);

  const estimateBaseFee = useCallback(async () => {
    try {
      if (!assetMetadata) throw new Error('Metadata not found');

      const to = toResolved;
      const tez = isTezAsset(assetSlug);

      if (balance.isZero()) {
        throw new ZeroBalanceError();
      }

      if (!tez) {
        if (tezBalance.isZero()) {
          throw new ZeroTEZBalanceError();
        }
      }

      const [transferParams, manager] = await Promise.all([
        toTransferParams(tezos, assetSlug, assetMetadata, accountPkh, to, toPenny(assetMetadata)),
        tezos.rpc.getManagerKey(acc.type === TempleAccountType.ManagedKT ? acc.owner : accountPkh)
      ]);

      const estmtnMax = await estimateMaxFee(acc, tez, tezos, to, balance, transferParams, manager);

      let estimatedBaseFee = mumavToTz(estmtnMax.burnFeeMumav + estmtnMax.suggestedFeeMumav);
      if (!hasManager(manager)) {
        estimatedBaseFee = estimatedBaseFee.plus(mumavToTz(DEFAULT_FEE.REVEAL));
      }

      if (tez ? estimatedBaseFee.isGreaterThanOrEqualTo(balance) : estimatedBaseFee.isGreaterThan(tezBalance!)) {
        throw new NotEnoughFundsError();
      }

      return estimatedBaseFee;
    } catch (err: any) {
      await delay();

      if (err instanceof ArtificialError) {
        return err;
      }

      console.error(err);
      throw err;
    }
  }, [assetMetadata, toResolved, assetSlug, balance, tezos, accountPkh, acc, tezBalance]);

  const {
    data: baseFee,
    error: estimateBaseFeeError,
    isValidating: estimating
  } = useTypedSWR(
    () => (toFilled ? ['transfer-base-fee', tezos.checksum, assetSlug, accountPkh, toResolved] : null),
    estimateBaseFee,
    {
      shouldRetryOnError: false,
      focusThrottleInterval: 10_000,
      dedupingInterval: BLOCK_DURATION
    }
  );
  const feeError = getBaseFeeError(baseFee, estimateBaseFeeError);
  const estimationError = getFeeError(estimating, feeError);

  const maxAddFee = useMemo(() => {
    if (baseFee instanceof BigNumber) {
      return tezBalance.minus(baseFee).minus(PENNY).toNumber();
    }
    return undefined;
  }, [tezBalance, baseFee]);

  const safeFeeValue = useMemo(() => (maxAddFee && feeValue > maxAddFee ? maxAddFee : feeValue), [maxAddFee, feeValue]);

  const maxAmount = useMemo(() => {
    if (!(baseFee instanceof BigNumber)) return null;

    const maxAmountAsset = isTezAsset(assetSlug) ? getMaxAmountToken(acc, balance, baseFee, safeFeeValue) : balance;
    const maxAmountFiat = getMaxAmountFiat(assetPrice.toNumber(), maxAmountAsset);

    return shoudUseFiat ? maxAmountFiat : maxAmountAsset;
  }, [acc, assetSlug, balance, baseFee, safeFeeValue, shoudUseFiat, assetPrice]);

  const validateAmount = useCallback(
    (v?: number) => {
      if (v === undefined) return t('required');
      if (!isKTAddress(toValue) && v === 0) {
        return t('amountMustBePositive');
      }
      if (!maxAmount) return true;
      const vBN = new BigNumber(v);
      return vBN.isLessThanOrEqualTo(maxAmount) || t('maximalAmount', toLocalFixed(maxAmount));
    },
    [maxAmount, toValue]
  );

  const handleFeeFieldChange = useCallback<FeeComponentProps['handleFeeFieldChange']>(
    ([v]) => (maxAddFee && v > maxAddFee ? maxAddFee : v),
    [maxAddFee]
  );

  const maxAmountStr = maxAmount?.toString();
  useEffect(() => {
    if (formState.dirtyFields.has('amount')) {
      triggerValidation('amount');
    }
  }, [formState.dirtyFields, triggerValidation, maxAmountStr]);

  const handleSetMaxAmount = useCallback(() => {
    if (maxAmount) {
      setValue('amount', maxAmount.toString());
      triggerValidation('amount');
    }
  }, [setValue, maxAmount, triggerValidation]);

  const handleAmountFieldFocus = useCallback<FocusEventHandler>(evt => {
    evt.preventDefault();
    amountFieldRef.current?.focus({ preventScroll: true });
  }, []);

  const [submitError, setSubmitError] = useSafeState<any>(null, `${tezos.checksum}_${toResolved}`);

  const toAssetAmount = useCallback(
    (fiatAmount: BigNumber.Value) =>
      new BigNumber(fiatAmount)
        .dividedBy(assetPrice ?? 1)
        .toFormat(assetMetadata?.decimals ?? 0, BigNumber.ROUND_FLOOR, {
          decimalSeparator: '.'
        }),
    [assetPrice, assetMetadata?.decimals]
  );

  const onSubmit = useCallback(
    async ({ amount, fee: feeVal }: FormData) => {
      if (formState.isSubmitting) return;
      setSubmitError(null);
      setOperation(null);

      formAnalytics.trackSubmit();

      try {
        if (!assetMetadata) throw new Error('Metadata not found');

        let op: TransactionWalletOperation | TransactionOperation;
        if (isKTAddress(acc.publicKeyHash)) {
          const michelsonLambda = isKTAddress(toResolved) ? transferToContract : transferImplicit;

          const contract = await loadContract(tezos, acc.publicKeyHash);
          op = await contract.methods.do(michelsonLambda(toResolved, tzToMumav(amount))).send({ amount: 0 });
        } else {
          const actualAmount = shoudUseFiat ? toAssetAmount(amount) : amount;
          const transferParams = await toTransferParams(
            tezos,
            assetSlug,
            assetMetadata,
            accountPkh,
            toResolved,
            actualAmount
          );
          const estmtn = await tezos.estimate.transfer(transferParams);
          const addFee = tzToMumav(feeVal ?? 0);
          const fee = addFee.plus(estmtn.suggestedFeeMumav).toNumber();
          op = await tezos.wallet.transfer({ ...transferParams, fee }).send();
        }
        setOperation(op);
        reset({ to: '', fee: RECOMMENDED_ADD_FEE });

        formAnalytics.trackSubmitSuccess();
      } catch (err: any) {
        formAnalytics.trackSubmitFail();

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
      acc,
      formState.isSubmitting,
      tezos,
      assetSlug,
      assetMetadata,
      setSubmitError,
      setOperation,
      reset,
      accountPkh,
      toResolved,
      shoudUseFiat,
      toAssetAmount,
      formAnalytics
    ]
  );

  const [pickedFromDropdown, setPickedFromDropdown] = useState(false);

  const handleAccountSelect = useCallback(
    (account: string) => {
      setValue('to', account);
      triggerValidation('to');
      setPickedFromDropdown(true);
    },
    [setValue, triggerValidation]
  );

  const restFormDisplayed = getRestFormDisplayed(toFilled, baseFee, estimationError);
  const estimateFallbackDisplayed = getEstimateFallBackDisplayed(toFilled, baseFee, estimating);

  const [toFieldFocused, setToFieldFocused] = useState(false);

  const handleToFieldFocus = useCallback(() => {
    toFieldRef.current?.focus();
    setToFieldFocused(true);
  }, [setToFieldFocused]);

  const handleToFieldBlur = useCallback(() => {
    setToFieldFocused(false);
    onBlur();
  }, [setToFieldFocused, onBlur]);

  const allContactsWithoutCurrent = useMemo(
    () => allContacts.filter(c => c.address !== accountPkh),
    [allContacts, accountPkh]
  );

  const handlePickedAccountClean = useCallback(() => {
    setPickedFromDropdown(false);
    setValue('to', '');
  }, [setValue]);

  const { selectedFiatCurrency } = useFiatCurrency();

  // const visibleAssetSymbol = shoudUseFiat ? selectedFiatCurrency.symbol : assetSymbol;

  const isContactsDropdownOpen = getFilled(toFilled, toFieldFocused);

  return (
    <form className={clsx('min-h-96 flex flex-col flex-grow', popup && 'pb-8')} onSubmit={handleSubmit(onSubmit)}>
      <Controller
        name="to"
        as={
          pickedFromDropdown && filledContact ? (
            <div>
              <div className="text-base font-normal text-primary-white mb-3">
                <T id="sendTo" />
              </div>
              <div className="bg-primary-card rounded-xl overflow-hidden mb-4">
                <ContactsDropdownItemSecondary
                  contact={filledContact}
                  active={false}
                  onClick={handlePickedAccountClean}
                />
              </div>
            </div>
          ) : (
            <NoSpaceField
              ref={toFieldRef}
              onFocus={handleToFieldFocus}
              extraInner={
                <InnerDropDownComponentGuard
                  contacts={allContactsWithoutCurrent}
                  opened={isContactsDropdownOpen}
                  onSelect={handleAccountSelect}
                  searchTerm={toValue}
                />
              }
              extraInnerWrapper="unset"
            />
          )
        }
        control={control}
        rules={{
          validate: (value: any) => validateRecipient(value, domainsClient)
        }}
        onChange={([v]) => v}
        onBlur={handleToFieldBlur}
        textarea
        rows={2}
        cleanable={Boolean(toValue)}
        onClean={cleanToField}
        id="send-to"
        label={t('sendTo')}
        placeholder={t('enterAddress')}
        errorCaption={!toFieldFocused ? errors.to?.message : null}
        style={{
          resize: 'none'
        }}
        containerClassName="mb-2"
        testID={SendFormSelectors.recipientInput}
      />

      {resolvedAddress && (
        <div className="mb-4 -mt-3 text-xs font-light text-white flex flex-wrap items-center">
          <span className="mr-1 whitespace-nowrap">{t('resolvedAddress')}:</span>
          <span className="font-normal">{resolvedAddress}</span>
        </div>
      )}

      {toFilled && !filledContact ? (
        <div className="mb-4 -mt-3 text-xs font-light text-gray-600 flex flex-wrap items-center">
          <button
            type="button"
            className="text-sm text-secondary-white"
            onClick={() => onAddContactRequested(toResolved)}
          >
            <T id="addThisAddressToContacts" />
          </button>
        </div>
      ) : null}

      <div className="relative">
        <Controller
          name="amount"
          as={<AssetField ref={amountFieldRef} onFocus={handleAmountFieldFocus} />}
          control={control}
          rules={{
            validate: validateAmount
          }}
          onChange={([v]) => v}
          onFocus={() => amountFieldRef.current?.focus()}
          id="send-amount"
          assetSymbol={assetSymbol}
          assetDecimals={shoudUseFiat ? 2 : assetMetadata?.decimals ?? 0}
          label={t('amount')}
          labelDescription={
            restFormDisplayed &&
            maxAmount && (
              <div className="flex items-center w-full">
                <T id="availableToSend" />
                <div className="flex items-center">
                  &nbsp;
                  {shoudUseFiat ? <span className="pr-px">{selectedFiatCurrency.symbol}</span> : null}
                  <div className={clsx('truncate text-sm text-secondary-white text-right flex justify-end')}>
                    <Money smallFractionFont={false} cryptoDecimals={assetMetadata?.decimals}>
                      {maxAmount}
                    </Money>
                  </div>
                </div>
                <span onClick={handleSetMaxAmount} className="text-accent-blue cursor-pointer ml-auto">
                  &nbsp;
                  <T id="useMax" />
                </span>
              </div>
            )
          }
          textarea
          rows={2}
          placeholder={0}
          errorCaption={restFormDisplayed && errors.amount?.message}
          containerClassName="mb-2"
          autoFocus={Boolean(maxAmount)}
          testID={SendFormSelectors.amountInput}
          style={amountStyle}
          childForInputWrapper={
            <TokenToFiat
              amountValue={amountValue}
              assetMetadata={assetMetadata}
              shoudUseFiat={shoudUseFiat}
              assetSlug={assetSlug}
              toAssetAmount={toAssetAmount}
            />
          }
        />
      </div>

      {estimateFallbackDisplayed ? (
        <SpinnerSection />
      ) : (
        <FeeSection
          restFormDisplayed={restFormDisplayed}
          submitError={submitError}
          estimationError={estimationError}
          toResolved={toResolved}
          toFilledWithKTAddress={toFilledWithKTAddress}
          control={control}
          handleFeeFieldChange={handleFeeFieldChange}
          baseFee={baseFee}
          error={errors.fee}
          isSubmitting={formState.isSubmitting}
        />
      )}
      <div className="flex-1" />

      <FormSubmitButton
        loading={formState.isSubmitting}
        disabled={
          Boolean(estimationError) ||
          estimateFallbackDisplayed ||
          formState.isSubmitting ||
          !toResolved ||
          Boolean(errors?.to)
        }
        testID={SendFormSelectors.sendButton}
        className="mt-6"
      >
        <T id="send" />
      </FormSubmitButton>
    </form>
  );
};

interface TokenToFiatProps {
  amountValue: string;
  assetMetadata: AssetMetadataBase | nullish;
  shoudUseFiat: boolean;
  assetSlug: string;
  toAssetAmount: (fiatAmount: BigNumber.Value) => string;
}

const TokenToFiat: React.FC<TokenToFiatProps> = ({
  amountValue = new BigNumber(0),
  assetMetadata,
  shoudUseFiat,
  assetSlug,
  toAssetAmount
}) => {
  if (!amountValue) return null;

  return (
    <div className="absolute left-4 bottom-4">
      {shoudUseFiat ? (
        <div className="text-secondary-white text-sm ">
          <span className="text-base-plus">≈&nbsp;</span>
          <span className="font-normal text-secondary-white mr-1">{toAssetAmount(amountValue)}</span>{' '}
          <T id="inAsset" substitutions={getAssetSymbol(assetMetadata, true)} />
        </div>
      ) : (
        <InFiat
          assetSlug={assetSlug}
          volume={amountValue}
          roundingMode={BigNumber.ROUND_FLOOR}
          smallFractionFont={false}
        >
          {({ balance, symbol }) => (
            <div className="flex items-baseline text-sm text-secondary-white ">
              <span>≈&nbsp;</span>
              <span className="flex items-baseline">
                <span className="pr-px">{symbol}</span>
                {balance}
              </span>
            </div>
          )}
        </InFiat>
      )}
    </div>
  );
};

interface FeeComponentProps {
  restFormDisplayed: boolean;
  submitError: any;
  estimationError: any;
  toResolved: string;
  toFilledWithKTAddress: boolean;
  control: any;
  handleFeeFieldChange: ([v]: any) => any;
  baseFee?: BigNumber | Error | undefined;
  error?: FieldError;
  isSubmitting: boolean;
}

const getMaxAmountFiat = (assetPrice: number | null, maxAmountAsset: BigNumber) =>
  assetPrice ? maxAmountAsset.times(assetPrice).decimalPlaces(2, BigNumber.ROUND_FLOOR) : new BigNumber(0);

const getMaxAmountToken = (acc: TempleAccount, balance: BigNumber, baseFee: BigNumber, safeFeeValue: number) =>
  BigNumber.max(
    acc.type === TempleAccountType.ManagedKT
      ? balance
      : balance
          .minus(baseFee)
          .minus(safeFeeValue ?? 0)
          .minus(PENNY),
    0
  );

type TransferParamsInvariant =
  | TransferParams
  | {
      to: string;
      amount: any;
    };

const estimateMaxFee = async (
  acc: TempleAccount,
  tez: boolean,
  tezos: ReactiveTezosToolkit,
  to: string,
  balanceBN: BigNumber,
  transferParams: TransferParamsInvariant,
  manager: ManagerKeyResponse
) => {
  let estmtnMax: Estimate;
  if (acc.type === TempleAccountType.ManagedKT) {
    const michelsonLambda = isKTAddress(to) ? transferToContract : transferImplicit;

    const contract = await loadContract(tezos, acc.publicKeyHash);
    const transferParamsWrapper = contract.methods.do(michelsonLambda(to, tzToMumav(balanceBN))).toTransferParams();
    estmtnMax = await tezos.estimate.transfer(transferParamsWrapper);
  } else if (tez) {
    const estmtn = await tezos.estimate.transfer(transferParams);
    let amountMax = balanceBN.minus(mumavToTz(estmtn.totalCost));
    if (!hasManager(manager)) {
      amountMax = amountMax.minus(mumavToTz(DEFAULT_FEE.REVEAL));
    }
    estmtnMax = await tezos.estimate.transfer({
      to,
      amount: amountMax.toString() as any
    });
  } else {
    estmtnMax = await tezos.estimate.transfer(transferParams);
  }
  return estmtnMax;
};

const getAssetPriceByNetwork = (network: TempleNetworkType, assetPrice: number | null) =>
  network === 'main' && assetPrice !== null;

const getBaseFeeError = (baseFee: BigNumber | ArtificialError | undefined, estimateBaseFeeError: any) =>
  baseFee instanceof Error ? baseFee : estimateBaseFeeError;

const getFeeError = (estimating: boolean, feeError: any) => (!estimating ? feeError : null);

const getEstimateFallBackDisplayed = (toFilled: boolean | '', baseFee: any, estimating: boolean) =>
  toFilled && !baseFee && estimating;

const getRestFormDisplayed = (toFilled: boolean | '', baseFee: any, estimationError: any) =>
  Boolean(toFilled && (baseFee || estimationError));

const InnerDropDownComponentGuard: React.FC<ContactsDropdownProps> = ({ contacts, opened, onSelect, searchTerm }) => {
  if (contacts.length <= 0) return null;
  return <ContactsDropdown contacts={contacts} opened={opened} onSelect={onSelect} searchTerm={searchTerm} />;
};

const getFilled = (toFilled: boolean | '', toFieldFocused: boolean) => (!toFilled ? toFieldFocused : false);

// const getDomainTextError = (canUseDomainNames: boolean) =>
//   canUseDomainNames ? 'recipientInputPlaceholderWithDomain' : 'recipientInputPlaceholder';

// const getAssetDomainName = (canUseDomainNames: boolean) =>
//   canUseDomainNames ? 'tokensRecepientInputDescriptionWithDomain' : 'tokensRecepientInputDescription';
