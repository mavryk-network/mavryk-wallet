import { useCallback, useMemo, useRef } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { isDefined } from '@rnw-community/shared';
import BigNumber from 'bignumber.js';
import debounce from 'debounce-promise';

import { buyWithCreditCardKeys, usePairLimitsFromCache } from 'lib/buy-with-credit-card/use-buy-with-credit-card.query';
import { mergeProvidersLimits } from 'lib/buy-with-credit-card/merge-limits';
import { TopUpProviderId } from 'lib/buy-with-credit-card/top-up-provider-id.enum';
import {
  PaymentProviderInterface,
  TopUpInputInterface,
  TopUpOutputInterface
} from 'lib/buy-with-credit-card/topup.interface';

import { useBuyWithCreditCardForm } from './use-buy-with-credit-card-form';
import { usePaymentProviders } from './use-payment-providers';

export const useFormInputsCallbacks = (
  form: ReturnType<typeof useBuyWithCreditCardForm>,
  updateProvidersOutputs: ReturnType<typeof usePaymentProviders>['updateOutputAmounts'],
  formIsLoading: boolean,
  setFormIsLoading: (newValue: boolean) => void
) => {
  const { formValues, lazySetValue, triggerValidation } = form;
  const { inputAmount, inputCurrency, outputToken, topUpProvider } = formValues;
  const outputCalculationDataRef = useRef({ inputAmount, inputCurrency, outputToken });
  const manuallySelectedProviderIdRef = useRef<TopUpProviderId>();
  const queryClient = useQueryClient();
  const getPairLimitsFromCache = usePairLimitsFromCache();

  const setPaymentProvider = useCallback(
    (newProvider?: PaymentProviderInterface) => {
      lazySetValue({ topUpProvider: newProvider, outputAmount: newProvider?.outputAmount });
      triggerValidation();
    },
    [lazySetValue, triggerValidation]
  );

  const updateOutput = useMemo(
    () =>
      debounce(
        async (
          newInputAmount: number | undefined,
          newInputAsset: TopUpInputInterface,
          newOutputAsset: TopUpOutputInterface
        ) => {
          const correctedNewInputAmount = isDefined(newInputAmount)
            ? new BigNumber(newInputAmount).decimalPlaces(newInputAsset.precision).toNumber()
            : undefined;

          lazySetValue({
            inputAmount: correctedNewInputAmount,
            inputCurrency: newInputAsset,
            outputToken: newOutputAsset
          });

          // Discarding current provider's output instead of provider itself (i.e. `setPaymentProvider(undefined)`)
          // Thus purchase link loading is delayed till provider is updated
          if (isDefined(topUpProvider)) setPaymentProvider({ ...topUpProvider, outputAmount: undefined });

          await updateProvidersOutputs(correctedNewInputAmount, newInputAsset, newOutputAsset);

          setFormIsLoading(false);
        },
        200
      ),
    [updateProvidersOutputs, lazySetValue, topUpProvider, setPaymentProvider]
  );

  const handleInputValueChange = useCallback(
    (newInputAmount: number | undefined, newInputAsset: TopUpInputInterface) => {
      outputCalculationDataRef.current = { inputAmount: newInputAmount, inputCurrency: newInputAsset, outputToken };
      setFormIsLoading(true);
      void updateOutput(newInputAmount, newInputAsset, outputToken);
    },
    [updateOutput, outputToken]
  );

  const handleInputAssetChange = useCallback(
    (newValue: TopUpInputInterface) => handleInputValueChange(inputAmount, newValue),
    [handleInputValueChange, inputAmount]
  );

  const handleInputAmountChange = useCallback(
    (newValue?: number) => handleInputValueChange(newValue, inputCurrency),
    [handleInputValueChange, inputCurrency]
  );

  const handleOutputTokenChange = useCallback(
    (newValue: TopUpOutputInterface) => {
      const pairLimits = getPairLimitsFromCache(inputCurrency.code, newValue.code);
      const { min: minInputAmount, max: maxInputAmount } = mergeProvidersLimits(pairLimits);

      const patchedInputCurrency = {
        ...inputCurrency,
        minAmount: minInputAmount,
        maxAmount: maxInputAmount
      };

      outputCalculationDataRef.current = { inputAmount, inputCurrency: patchedInputCurrency, outputToken: newValue };
      setFormIsLoading(true);
      updateOutput(inputAmount, patchedInputCurrency, newValue);
    },
    [inputAmount, inputCurrency, updateOutput, getPairLimitsFromCache]
  );

  const handlePaymentProviderChange = useCallback(
    (newProvider?: PaymentProviderInterface) => {
      manuallySelectedProviderIdRef.current = newProvider?.id;
      setPaymentProvider(newProvider);
    },
    [setPaymentProvider]
  );

  const refreshForm = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: buyWithCreditCardKeys.currencies });
    queryClient.invalidateQueries({
      queryKey: buyWithCreditCardKeys.pairLimits(inputCurrency.code, outputToken.code)
    });
    if (!formIsLoading) {
      outputCalculationDataRef.current = { inputAmount, inputCurrency, outputToken };
      setFormIsLoading(true);
      updateOutput(inputAmount, inputCurrency, outputToken);
    }
  }, [queryClient, inputCurrency, outputToken, updateOutput, formIsLoading, inputAmount]);

  return {
    handleInputAssetChange,
    handleInputAmountChange,
    handleOutputTokenChange,
    handlePaymentProviderChange,
    setPaymentProvider,
    manuallySelectedProviderIdRef,
    refreshForm
  };
};
