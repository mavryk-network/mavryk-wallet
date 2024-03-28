import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isDefined } from '@rnw-community/shared';
import { TransferParams } from '@taquito/taquito';
import { BatchWalletOperation } from '@taquito/taquito/dist/types/wallet/batch-operation';
import BigNumber from 'bignumber.js';
import classNames from 'clsx';
import { Controller, useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';

import { Alert, Divider, FormSubmitButton } from 'app/atoms';
import { useBlockLevel } from 'app/hooks/use-block-level.hook';
import { useOperationStatus } from 'app/hooks/use-operation-status';
import { useSwap } from 'app/hooks/use-swap';
import { ReactComponent as InfoIcon } from 'app/icons/info.svg';
import { ReactComponent as ToggleIcon } from 'app/icons/toggle.svg';
import { buildSwapPageUrlQuery } from 'app/pages/Swap/utils/build-url-query';
import { useSelector } from 'app/store';
import { loadSwapParamsAction, resetSwapParamsAction } from 'app/store/swap/actions';
import { useSwapParamsSelector, useSwapTokenSelector, useSwapTokensSelector } from 'app/store/swap/selectors';
import OperationStatus from 'app/templates/OperationStatus';
import { setTestID, useFormAnalytics } from 'lib/analytics';
import { fetchRoute3SwapParams } from 'lib/apis/route3/fetch-route3-swap-params';
import { TEZ_TOKEN_SLUG } from 'lib/assets';
import { KNOWN_TOKENS_SLUGS } from 'lib/assets/known-tokens';
import { useBalance } from 'lib/balances/hooks';
import { T, t } from 'lib/i18n';
import { useAssetMetadata, useGetTokenMetadata } from 'lib/metadata';
import {
  BURN_ADDREESS,
  MAX_ROUTING_FEE_CHAINS,
  ROUTING_FEE_ADDRESS,
  ROUTING_FEE_SLIPPAGE_RATIO,
  SWAP_THRESHOLD_TO_GET_CASHBACK,
  TEMPLE_TOKEN
} from 'lib/route3/constants';
import { isLiquidityBakingParamsResponse } from 'lib/route3/interfaces';
import { getPercentageRatio } from 'lib/route3/utils/get-percentage-ratio';
import { getRoute3TokenBySlug } from 'lib/route3/utils/get-route3-token-by-slug';
import { ROUTING_FEE_PERCENT } from 'lib/swap-router/config';
import { useAccount, useTezos } from 'lib/temple/front';
import { atomsToTokens, tokensToAtoms } from 'lib/temple/helpers';
import useTippy from 'lib/ui/useTippy';
import { ZERO } from 'lib/utils/numbers';
import { parseTransferParamsToParamsWithKind } from 'lib/utils/parse-transfer-params';
import {
  calculateFeeFromOutput,
  calculateRoutingInputAndFeeFromInput,
  getRoutingFeeTransferParams
} from 'lib/utils/swap.utils';
import { HistoryAction, navigate } from 'lib/woozie';

import { SwapExchangeRate } from './SwapExchangeRate/SwapExchangeRate';
import { SwapFormValue, SwapInputValue, useSwapFormDefaultValue } from './SwapForm.form';
import { SwapFormSelectors, SwapFormFromInputSelectors, SwapFormToInputSelectors } from './SwapForm.selectors';
import { cashbackInfoTippyProps, feeInfoTippyProps } from './SwapForm.tippy';
import { SlippageToleranceInput } from './SwapFormInput/SlippageToleranceInput/SlippageToleranceInput';
import { slippageToleranceInputValidationFn } from './SwapFormInput/SlippageToleranceInput/SlippageToleranceInput.validation';
import { SwapFormInput } from './SwapFormInput/SwapFormInput';
import { SwapMinimumReceived } from './SwapMinimumReceived/SwapMinimumReceived';
import { SwapRoute } from './SwapRoute/SwapRoute';

const EXCHANGE_XTZ_RESERVE = new BigNumber('0.3');

export const SwapForm: FC = () => {
  const dispatch = useDispatch();
  const tezos = useTezos();
  const blockLevel = useBlockLevel();
  const { publicKeyHash } = useAccount();
  const getSwapParams = useSwap();
  const { data: route3Tokens } = useSwapTokensSelector();
  const swapParams = useSwapParamsSelector();
  const allUsdToTokenRates = useSelector(state => state.currency.usdToTokenRates.data);
  const getTokenMetadata = useGetTokenMetadata();
  const account = useAccount();

  const formAnalytics = useFormAnalytics('SwapForm');

  const feeInfoIconRef = useTippy<HTMLSpanElement>(feeInfoTippyProps);

  const defaultValues = useSwapFormDefaultValue();
  const {
    handleSubmit,
    errors,
    watch,
    setValue,
    control,
    register,
    triggerValidation,
    formState: { dirtyFields }
  } = useForm<SwapFormValue>({
    defaultValues,
    mode: 'onChange',
    validateCriteriaMode: 'firstError'
  });

  const inputValue = watch('input') ?? { assetSlug: undefined, amount: 0 };
  const outputValue = watch('output') ?? { assetSlug: undefined, amount: 0 };
  const slippageTolerance = watch('slippageTolerance');

  const { value: balance } = useBalance(inputValue.assetSlug ?? 'tez', account.publicKeyHash);

  const maxAmount = useMemo(() => {
    if (!inputValue.assetSlug) {
      return new BigNumber(0);
    }

    const maxSendAmount = inputValue.assetSlug === TEZ_TOKEN_SLUG ? balance?.minus(EXCHANGE_XTZ_RESERVE) : balance;

    return maxSendAmount ?? new BigNumber(0);
  }, [inputValue.assetSlug, balance]);

  const exceededMaxAmount = useMemo(
    () => (inputValue.amount ?? new BigNumber(0)).isGreaterThan(maxAmount),
    [inputValue.amount, maxAmount]
  );

  const isFormBtnDisabled =
    !inputValue?.assetSlug ||
    !outputValue?.assetSlug ||
    !inputValue?.amount ||
    !outputValue.amount ||
    exceededMaxAmount;

  const fromRoute3Token = useSwapTokenSelector(inputValue.assetSlug ?? '');
  const toRoute3Token = useSwapTokenSelector(outputValue.assetSlug ?? '');

  const inputAssetMetadata = useAssetMetadata(inputValue.assetSlug ?? TEZ_TOKEN_SLUG)!;
  const outputAssetMetadata = useAssetMetadata(outputValue.assetSlug ?? TEZ_TOKEN_SLUG)!;

  const [error, setError] = useState<Error>();
  const [operation, setOperation] = useState<BatchWalletOperation>();
  const isSubmitButtonPressedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlertVisible, setIsAlertVisible] = useState(false);

  const slippageRatio = useMemo(() => getPercentageRatio(slippageTolerance ?? 0), [slippageTolerance]);
  const minimumReceivedAmountAtomic = useMemo(() => {
    if (isDefined(swapParams.data.output)) {
      return tokensToAtoms(new BigNumber(swapParams.data.output), outputAssetMetadata.decimals)
        .multipliedBy(slippageRatio)
        .integerValue(BigNumber.ROUND_DOWN);
    } else {
      return ZERO;
    }
  }, [swapParams.data.output, outputAssetMetadata.decimals, slippageRatio]);

  const chainsAreAbsent = isLiquidityBakingParamsResponse(swapParams.data)
    ? swapParams.data.tzbtcChain.chains.length === 0 && swapParams.data.xtzChain.chains.length === 0
    : swapParams.data.chains.length === 0;

  const atomsInputValue = useMemo(
    () => tokensToAtoms(inputValue.amount ?? ZERO, inputAssetMetadata.decimals),
    [inputAssetMetadata.decimals, inputValue.amount]
  );

  useEffect(() => {
    const { swapInputMinusFeeAtomic } = calculateRoutingInputAndFeeFromInput(
      tokensToAtoms(inputValue.amount ?? ZERO, inputAssetMetadata.decimals)
    );

    if (isDefined(fromRoute3Token) && isDefined(toRoute3Token)) {
      dispatch(
        loadSwapParamsAction.submit({
          fromSymbol: fromRoute3Token.symbol,
          toSymbol: toRoute3Token.symbol,
          amount: atomsToTokens(swapInputMinusFeeAtomic, fromRoute3Token.decimals).toFixed()
        })
      );
    }
  }, [blockLevel]);

  useEffect(() => {
    if (Number(swapParams.data.input) > 0 && chainsAreAbsent) {
      setIsAlertVisible(true);
    } else {
      setIsAlertVisible(false);
    }
  }, [chainsAreAbsent, swapParams.data]);

  useEffect(
    () =>
      navigate(
        { pathname: '/swap', search: buildSwapPageUrlQuery(inputValue.assetSlug, outputValue.assetSlug) },
        HistoryAction.Replace
      ),
    [inputValue.assetSlug, outputValue.assetSlug]
  );

  useEffect(() => {
    if (isSubmitButtonPressedRef.current) {
      triggerValidation(['input', 'output'], true);
    }
  }, [triggerValidation, inputValue.amount, swapParams.data.output, outputValue.assetSlug]);

  useEffect(() => {
    setValue('output', {
      assetSlug: outputValue.assetSlug,
      amount: isDefined(swapParams.data.output) ? new BigNumber(swapParams.data.output) : undefined
    });
  }, [swapParams.data.output, setValue, triggerValidation, outputValue.assetSlug]);

  useEffect(() => {
    register('input', {
      validate: ({ assetSlug, amount }: SwapInputValue) => {
        if (!dirtyFields.has('input')) return true;

        if (!amount || amount.isLessThan(0)) {
          return t('amountMustBePositive');
        }
        if (amount.isGreaterThan(maxAmount)) return t('maxAmountErrorMsg');
        return true;
      }
    });

    register('output', {
      validate: ({ assetSlug, amount }: SwapInputValue) => {
        if (!dirtyFields.has('output')) return true;

        // Do NOT show err msg if no amount
        if (!amount) return true;

        if (amount.isLessThanOrEqualTo(0)) {
          return t('amountMustBePositive');
        }

        return true;
      }
    });
  }, [register, dirtyFields, maxAmount]);

  const successScreenProps = useMemo(
    () => ({
      pageTitle: 'swap',
      btnText: 'goToMain',
      contentId: 'hash',
      // @ts-expect-error
      contentIdFnProps: { hash: operation?.opHash ?? operation?.hash, i18nKey: 'swap' },
      subHeader: 'success'
    }),
    // @ts-expect-error
    [operation?.hash, operation?.opHash]
  );

  // @ts-expect-error
  useOperationStatus(operation, successScreenProps);

  const onSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);

    const analyticsProperties = {
      inputAsset: inputValue.assetSlug,
      outputAsset: outputValue.assetSlug
    };

    formAnalytics.trackSubmit(analyticsProperties);

    const { swapInputMinusFeeAtomic, routingFeeFromInputAtomic } =
      calculateRoutingInputAndFeeFromInput(atomsInputValue);
    const routingFeeFromOutputAtomic = calculateFeeFromOutput(atomsInputValue, minimumReceivedAmountAtomic);

    if (!fromRoute3Token || !toRoute3Token || !swapParams.data.output || !inputValue.assetSlug) {
      return;
    }

    try {
      setOperation(undefined);

      const allSwapParams: Array<TransferParams> = [];
      let routingOutputFeeTransferParams: TransferParams[] = await getRoutingFeeTransferParams(
        toRoute3Token,
        routingFeeFromOutputAtomic,
        publicKeyHash,
        ROUTING_FEE_ADDRESS,
        tezos
      );

      const route3SwapOpParams = await getSwapParams(
        fromRoute3Token,
        toRoute3Token,
        swapInputMinusFeeAtomic,
        minimumReceivedAmountAtomic,
        swapParams.data
      );

      if (!route3SwapOpParams) {
        return;
      }

      const inputTokenExhangeRate = allUsdToTokenRates[inputValue.assetSlug];
      const inputAmountInUsd = inputValue.amount?.multipliedBy(inputTokenExhangeRate) ?? ZERO;

      const isInputTokenTempleToken = inputValue.assetSlug === KNOWN_TOKENS_SLUGS.TEMPLE;
      const isSwapAmountMoreThreshold = inputAmountInUsd.isGreaterThanOrEqualTo(SWAP_THRESHOLD_TO_GET_CASHBACK);

      if (isInputTokenTempleToken && isSwapAmountMoreThreshold) {
        const routingInputFeeOpParams = await getRoutingFeeTransferParams(
          fromRoute3Token,
          routingFeeFromInputAtomic.dividedToIntegerBy(2),
          publicKeyHash,
          BURN_ADDREESS,
          tezos
        );
        allSwapParams.push(...routingInputFeeOpParams);
      } else if (isInputTokenTempleToken && !isSwapAmountMoreThreshold) {
        const routingFeeOpParams = await getRoutingFeeTransferParams(
          TEMPLE_TOKEN,
          routingFeeFromInputAtomic,
          publicKeyHash,
          ROUTING_FEE_ADDRESS,
          tezos
        );
        allSwapParams.push(...routingFeeOpParams);
      } else if (!isInputTokenTempleToken && isSwapAmountMoreThreshold && routingFeeFromInputAtomic.gt(0)) {
        const swapToTempleParams = await fetchRoute3SwapParams({
          fromSymbol: fromRoute3Token.symbol,
          toSymbol: TEMPLE_TOKEN.symbol,
          amount: atomsToTokens(routingFeeFromInputAtomic, fromRoute3Token.decimals).toFixed(),
          chainsLimit: MAX_ROUTING_FEE_CHAINS
        });

        const templeOutputAtomic = tokensToAtoms(
          new BigNumber(swapToTempleParams.output ?? ZERO),
          TEMPLE_TOKEN.decimals
        )
          .multipliedBy(ROUTING_FEE_SLIPPAGE_RATIO)
          .integerValue(BigNumber.ROUND_DOWN);

        const swapToTempleTokenOpParams = await getSwapParams(
          fromRoute3Token,
          TEMPLE_TOKEN,
          routingFeeFromInputAtomic,
          templeOutputAtomic,
          swapToTempleParams
        );

        allSwapParams.push(...swapToTempleTokenOpParams);

        const routingFeeOpParams = await getRoutingFeeTransferParams(
          TEMPLE_TOKEN,
          templeOutputAtomic.dividedToIntegerBy(2),
          publicKeyHash,
          BURN_ADDREESS,
          tezos
        );
        allSwapParams.push(...routingFeeOpParams);
      } else if (!isInputTokenTempleToken && isSwapAmountMoreThreshold) {
        const swapToTempleParams = await fetchRoute3SwapParams({
          fromSymbol: toRoute3Token.symbol,
          toSymbol: TEMPLE_TOKEN.symbol,
          amount: atomsToTokens(routingFeeFromOutputAtomic, toRoute3Token.decimals).toFixed(),
          chainsLimit: MAX_ROUTING_FEE_CHAINS
        });

        const templeOutputAtomic = tokensToAtoms(
          new BigNumber(swapToTempleParams.output ?? ZERO),
          TEMPLE_TOKEN.decimals
        )
          .multipliedBy(ROUTING_FEE_SLIPPAGE_RATIO)
          .integerValue(BigNumber.ROUND_DOWN);

        const swapToTempleTokenOpParams = await getSwapParams(
          toRoute3Token,
          TEMPLE_TOKEN,
          routingFeeFromOutputAtomic,
          templeOutputAtomic,
          swapToTempleParams
        );

        const routingFeeOpParams = await getRoutingFeeTransferParams(
          TEMPLE_TOKEN,
          templeOutputAtomic.dividedToIntegerBy(2),
          publicKeyHash,
          BURN_ADDREESS,
          tezos
        );
        routingOutputFeeTransferParams = [...swapToTempleTokenOpParams, ...routingFeeOpParams];
      } else if (!isInputTokenTempleToken && !isSwapAmountMoreThreshold) {
        const routingInputFeeOpParams = await getRoutingFeeTransferParams(
          fromRoute3Token,
          routingFeeFromInputAtomic,
          publicKeyHash,
          ROUTING_FEE_ADDRESS,
          tezos
        );
        allSwapParams.push(...routingInputFeeOpParams);
      }

      allSwapParams.push(...route3SwapOpParams, ...routingOutputFeeTransferParams);

      const opParams = allSwapParams.map(param => parseTransferParamsToParamsWithKind(param));

      const batchOperation = await tezos.wallet.batch(opParams).send();

      setError(undefined);
      formAnalytics.trackSubmitSuccess(analyticsProperties);
      setOperation(batchOperation);
    } catch (err: any) {
      if (err.message !== 'Declined') {
        setError(err);
      }
      formAnalytics.trackSubmitFail(analyticsProperties);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dispatchLoadSwapParams = useCallback((input: SwapInputValue, output: SwapInputValue) => {
    if (!input.assetSlug || !output.assetSlug) {
      return;
    }
    const inputMetadata = getTokenMetadata(input.assetSlug);

    if (!inputMetadata) {
      return;
    }

    const { swapInputMinusFeeAtomic: amount } = calculateRoutingInputAndFeeFromInput(
      tokensToAtoms(input.amount ?? ZERO, inputMetadata.decimals)
    );

    const route3FromToken = getRoute3TokenBySlug(route3Tokens, input.assetSlug);

    dispatch(
      loadSwapParamsAction.submit({
        fromSymbol: route3FromToken?.symbol ?? '',
        toSymbol: getRoute3TokenBySlug(route3Tokens, output.assetSlug)?.symbol ?? '',
        amount: amount && atomsToTokens(amount, route3FromToken?.decimals ?? 0).toFixed()
      })
    );
  }, []);

  const handleErrorClose = () => setError(undefined);
  const handleOperationClose = () => setOperation(undefined);

  const handleToggleIconClick = () => {
    setValue([{ input: { assetSlug: outputValue.assetSlug } }, { output: { assetSlug: inputValue.assetSlug } }]);
    dispatch(resetSwapParamsAction());
  };

  const handleInputChange = (newInputValue: SwapInputValue) => {
    setValue('input', newInputValue);

    if (newInputValue.assetSlug === outputValue.assetSlug) {
      setValue('output', {});
    }

    dispatchLoadSwapParams(newInputValue, outputValue);
  };

  const handleOutputChange = (newOutputValue: SwapInputValue) => {
    setValue('output', newOutputValue);

    if (newOutputValue.assetSlug === inputValue.assetSlug) {
      setValue('input', {});
    }

    dispatchLoadSwapParams(inputValue, newOutputValue);
  };

  useEffect(() => {
    isSubmitButtonPressedRef.current = true;
  }, []);

  const handleCloseAlert = () => setIsAlertVisible(false);

  return (
    <form className="mb-8" onSubmit={handleSubmit(onSubmit)}>
      {isAlertVisible && (
        <Alert
          closable
          className="mb-4"
          type="error"
          description={<T id="noRoutesFound" />}
          onClose={handleCloseAlert}
        />
      )}

      {operation && (
        <OperationStatus
          className="mb-8"
          closable
          typeTitle={t('swapNoun')}
          operation={operation}
          onClose={handleOperationClose}
        />
      )}

      <SwapFormInput
        name="input"
        value={inputValue}
        // @ts-expect-error
        error={errors.input?.message}
        label={<T id="from" />}
        onChange={handleInputChange}
        testIDs={{
          dropdown: SwapFormFromInputSelectors.dropdown,
          input: SwapFormFromInputSelectors.assetInput,
          searchInput: SwapFormFromInputSelectors.searchInput,
          assetDropDownButton: SwapFormFromInputSelectors.assetDropDownButton
        }}
        noItemsText={t('noItemsWithPositiveBalance')}
      />

      <div className="w-full my-6 flex justify-center">
        <button onClick={handleToggleIconClick} type="button" {...setTestID(SwapFormSelectors.swapPlacesButton)}>
          <ToggleIcon className="w-6 h-auto stroke-2 stroke-current text-accent-blue" />
        </button>
      </div>

      <SwapFormInput
        className="mb-6"
        name="output"
        value={outputValue}
        // @ts-expect-error
        error={errors.output?.message}
        label={<T id="toAsset" />}
        amountInputDisabled={true}
        onChange={handleOutputChange}
        testIDs={{
          dropdown: SwapFormToInputSelectors.dropdown,
          input: SwapFormToInputSelectors.assetInput,
          searchInput: SwapFormToInputSelectors.searchInput,
          assetDropDownButton: SwapFormToInputSelectors.assetDropDownButton
        }}
      />

      <FormSubmitButton
        className="w-full justify-center border-none mb-6"
        loading={isSubmitting || swapParams.isLoading}
        disabled={isFormBtnDisabled || isSubmitting || swapParams.isLoading}
        keepChildrenWhenLoading={swapParams.isLoading}
        testID={SwapFormSelectors.swapButton}
      >
        <T id={swapParams.isLoading ? 'searchingTheBestRoute' : 'swap'} />
      </FormSubmitButton>

      <div className="w-full p-4 bg-gray-910 rounded-2xl-plus">
        <section className={classNames('w-full text-base-plus text-white', 'flex flex-col gap-3')}>
          <div className="flex items-center justify-between">
            <div>
              <span ref={feeInfoIconRef} className="flex w-fit items-center text-white">
                <T id="routingFee" />
                &nbsp;
                <InfoIcon className="w-3 h-auto stroke-2 stroke-white mt-1" />
              </span>
            </div>
            <div className="text-right text-white">{ROUTING_FEE_PERCENT}%</div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <T id="exchangeRate" />
            </div>
            <div className="text-right text-white">
              <SwapExchangeRate
                inputAmount={swapParams.data.input !== undefined ? new BigNumber(swapParams.data.input) : undefined}
                outputAmount={swapParams.data.output !== undefined ? new BigNumber(swapParams.data.output) : undefined}
                inputAssetMetadata={inputAssetMetadata}
                outputAssetMetadata={outputAssetMetadata}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <T id="slippageTolerance" />
            </div>
            <div className="justify-end text-white flex">
              <Controller
                control={control}
                as={SlippageToleranceInput}
                error={!!errors.slippageTolerance}
                name="slippageTolerance"
                rules={{ validate: slippageToleranceInputValidationFn }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <T id="minimumReceived" />
            </div>
            <div className="text-right text-white">
              <SwapMinimumReceived
                minimumReceivedAmount={minimumReceivedAmountAtomic}
                outputAssetMetadata={outputAssetMetadata}
              />
            </div>
          </div>
        </section>
      </div>

      {error && (
        <Alert
          className="mb-6"
          type="error"
          title={t('error')}
          description={error.message}
          closable
          onClose={handleErrorClose}
        />
      )}

      <Divider className="my-6" color="bg-divider" />

      <SwapRoute className="mb-8" />
    </form>
  );
};
