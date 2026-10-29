import { useCallback } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BigNumber } from 'bignumber.js';

import { getMoonPayBuyQuote } from 'lib/apis/moonpay';
import { estimateAliceBobOutput } from 'lib/apis/temple/endpoints/alice-bob';
import { convertFiatAmountToCrypto } from 'lib/apis/utorg';
import { buyCardKeys } from 'lib/query-keys';
import { percentageToFraction } from 'lib/utils/percentage';

import { TopUpProviderId } from './top-up-provider-id.enum';
import { TopUpInputInterface, TopUpOutputInterface } from './topup.interface';
import {
  CARD_QUERY_POLICY,
  getProviderLimitsQueryOptions,
  useProviderCurrenciesQuery
} from './use-buy-with-credit-card.query';

type GetOutputAmountFunction = (
  inputAmount: number,
  inputAsset: TopUpInputInterface,
  outputAsset: TopUpOutputInterface
) => Promise<number>;

const GET_OUTPUT_AMOUNT_FUNCTIONS: Record<TopUpProviderId, GetOutputAmountFunction> = {
  [TopUpProviderId.MoonPay]: async (inputAmount, inputAsset, outputAsset) => {
    const { baseCurrencyAmount, quoteCurrencyAmount, extraFeePercentage, feeAmount, networkFeeAmount, totalAmount } =
      await getMoonPayBuyQuote(outputAsset.code.toLowerCase(), inputAsset.code.toLowerCase(), inputAmount);

    if (inputAmount < totalAmount) {
      const expectedBaseCurrencyAmount = BigNumber.max(
        new BigNumber(inputAmount)
          .minus(feeAmount)
          .minus(networkFeeAmount)
          .div(new BigNumber(1).plus(percentageToFraction(extraFeePercentage)))
          .decimalPlaces(inputAsset.precision ?? 0, BigNumber.ROUND_DOWN),
        0
      );

      return expectedBaseCurrencyAmount
        .times(quoteCurrencyAmount)
        .div(baseCurrencyAmount)
        .decimalPlaces(outputAsset.precision ?? 0, BigNumber.ROUND_DOWN)
        .toNumber();
    }

    return quoteCurrencyAmount;
  },
  [TopUpProviderId.Utorg]: async (inputAmount, inputAsset, outputAsset) =>
    convertFiatAmountToCrypto(inputAsset.code, outputAsset.code, inputAmount),
  [TopUpProviderId.AliceBob]: async (inputAmount, inputAsset, outputAsset) => {
    const response = await estimateAliceBobOutput(inputAmount.toString(), inputAsset.code, outputAsset.code);

    return response.data.outputAmount;
  }
};

/** Imperative form estimates share Query limits and publish only under their complete input key. */
export const useCardOutputQuery = (
  provider: TopUpProviderId,
  amount: number | undefined,
  input: TopUpInputInterface,
  output: TopUpOutputInterface
) => {
  const client = useQueryClient();
  const catalog = useProviderCurrenciesQuery(provider);
  const getOptions = useCallback(
    (nextAmount: number | undefined, nextInput: TopUpInputInterface, nextOutput: TopUpOutputInterface) => {
      const fiat = catalog.data?.fiat.find(item => item.code === nextInput.code);
      const crypto = catalog.data?.crypto.find(item => item.code === nextOutput.code);
      return {
        ...CARD_QUERY_POLICY,
        staleTime: 0,
        queryKey: buyCardKeys.output(provider, nextAmount, [
          { code: nextInput.code, precision: nextInput.precision },
          { code: nextOutput.code, precision: nextOutput.precision },
          fiat ?? null,
          crypto ?? null
        ]),
        queryFn: async () => {
          if (!nextAmount || !fiat || !crypto) return nextAmount === 0 ? 0 : null;
          const limits = await client.fetchQuery(
            getProviderLimitsQueryOptions(nextInput.code, nextOutput.code, provider, fiat, crypto)
          );
          if (nextAmount < limits.min || nextAmount > limits.max) return null;
          return GET_OUTPUT_AMOUNT_FUNCTIONS[provider](nextAmount, nextInput, nextOutput);
        }
      };
    },
    [catalog.data, client, provider]
  );
  const query = useQuery({ ...getOptions(amount, input, output), enabled: false, refetchOnMount: false });
  const updateOutputAmount = useCallback(
    async (nextAmount?: number, nextInput = input, nextOutput = output) => {
      try {
        return (await client.fetchQuery(getOptions(nextAmount, nextInput, nextOutput))) ?? undefined;
      } catch {
        // Query retains the error and prior usable estimate; the imperative form contract returns no new estimate.
        return undefined;
      }
    },
    [client, getOptions, input, output]
  );
  return { ...query, updateOutputAmount };
};
