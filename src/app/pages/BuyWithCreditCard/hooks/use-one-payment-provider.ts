import { useMemo } from 'react';

import {
  useProviderCurrenciesErrorSelector,
  usePairLimitsErrorsSelector
} from 'app/store/buy-with-credit-card/selectors';
import { getAssetSymbolToDisplay } from 'lib/buy-with-credit-card/get-asset-symbol-to-display';
import { TopUpProviderId } from 'lib/buy-with-credit-card/top-up-provider-id.enum';
import {
  PaymentProviderInterface,
  TopUpInputInterface,
  TopUpOutputInterface
} from 'lib/buy-with-credit-card/topup.interface';
import { ProviderErrors } from 'lib/buy-with-credit-card/types';
import { useCardOutputQuery } from 'lib/buy-with-credit-card/use-card-output.query';

import { useInputLimits } from './use-input-limits';
type PaymentProviderInitialData = Pick<PaymentProviderInterface, 'name' | 'id' | 'kycRequired'>;

const initialPaymentProvidersData: Record<TopUpProviderId, PaymentProviderInitialData> = {
  [TopUpProviderId.MoonPay]: {
    name: 'MoonPay',
    id: TopUpProviderId.MoonPay,
    kycRequired: true
  },
  [TopUpProviderId.Utorg]: {
    name: 'Utorg',
    id: TopUpProviderId.Utorg,
    kycRequired: true
  },
  [TopUpProviderId.AliceBob]: {
    name: 'Alice&Bob',
    id: TopUpProviderId.AliceBob,
    kycRequired: false
  }
};

export const usePaymentProvider = (
  providerId: TopUpProviderId,
  inputAmount: number | undefined,
  inputAsset: TopUpInputInterface,
  outputAsset: TopUpOutputInterface
) => {
  const outputQuery = useCardOutputQuery(providerId, inputAmount, inputAsset, outputAsset);
  const outputAmount = outputQuery.data ?? undefined;
  const outputError = outputQuery.error instanceof Error ? outputQuery.error : undefined;
  const outputAmountLoading = outputQuery.isFetching;
  const { updateOutputAmount } = outputQuery;
  const currenciesError = useProviderCurrenciesErrorSelector(providerId);
  const limitsErrors = usePairLimitsErrorsSelector(inputAsset.code, outputAsset.code);
  const { min: minInputAmount, max: maxInputAmount } = useInputLimits(providerId, inputAsset.code, outputAsset.code);
  const initialData = initialPaymentProvidersData[providerId];
  const provider = useMemo<PaymentProviderInterface>(
    () => ({
      ...initialData,
      isBestPrice: false,
      minInputAmount,
      maxInputAmount,
      inputAmount,
      inputDecimals: inputAsset.precision,
      inputSymbol: getAssetSymbolToDisplay(inputAsset),
      outputAmount,
      outputSymbol: getAssetSymbolToDisplay(outputAsset)
    }),
    [initialData, inputAmount, inputAsset, outputAmount, outputAsset, minInputAmount, maxInputAmount]
  );

  const errors: ProviderErrors = useMemo(
    () => ({
      currencies: currenciesError,
      limits: limitsErrors?.[providerId],
      output: outputError
    }),
    [currenciesError, limitsErrors, outputError, providerId]
  );

  return {
    provider,
    errors,
    updateOutputAmount,
    outputAmountLoading
  };
};
