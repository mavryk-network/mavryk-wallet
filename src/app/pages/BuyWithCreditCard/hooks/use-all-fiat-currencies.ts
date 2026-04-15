import { useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';

import { useFiatCurrencies, usePairLimitsData } from 'lib/buy-with-credit-card/use-buy-with-credit-card.query';
import { mergeProvidersLimits } from 'lib/buy-with-credit-card/merge-limits';
import { TopUpProviderId } from 'lib/buy-with-credit-card/top-up-provider-id.enum';
import { TopUpInputInterface } from 'lib/buy-with-credit-card/topup.interface';

export const useAllFiatCurrencies = (inputCurrencySymbol: string, outputTokenSymbol: string) => {
  const moonpayFiatCurrencies = useFiatCurrencies(TopUpProviderId.MoonPay);
  const utorgFiatCurrencies = useFiatCurrencies(TopUpProviderId.Utorg);
  const aliceBobFiatCurrencies = useFiatCurrencies(TopUpProviderId.AliceBob);

  const pairLimitsData = usePairLimitsData(inputCurrencySymbol, outputTokenSymbol);

  const allNonUniqueFiatCurrencies = useMemo(
    () => [...moonpayFiatCurrencies, ...utorgFiatCurrencies, ...aliceBobFiatCurrencies],
    [moonpayFiatCurrencies, utorgFiatCurrencies, aliceBobFiatCurrencies]
  );

  const pairLimits = useMemo(() => mergeProvidersLimits(pairLimitsData), [pairLimitsData]);

  const noPairLimitsFiatCurrencies = useMemo(
    () =>
      Object.values(
        allNonUniqueFiatCurrencies.reduce<Record<string, TopUpInputInterface>>((acc, currency) => {
          if (isDefined(acc[currency.code])) {
            const newTopUpCurrency = { ...acc[currency.code] };
            if (isDefined(currency.minAmount)) {
              newTopUpCurrency.minAmount = Math.min(newTopUpCurrency.minAmount ?? Infinity, currency.minAmount);
            }
            if (isDefined(currency.maxAmount)) {
              newTopUpCurrency.maxAmount = Math.max(newTopUpCurrency.maxAmount ?? 0, currency.maxAmount);
            }
            acc[currency.code] = newTopUpCurrency;
          } else {
            acc[currency.code] = { ...currency };
          }

          return acc;
        }, {})
      ).sort(({ code: aCode }, { code: bCode }) => aCode.localeCompare(bCode)),
    [allNonUniqueFiatCurrencies, inputCurrencySymbol]
  );

  const fiatCurrenciesWithPairLimits = useMemo(() => {
    const inputCurrencyIndex = noPairLimitsFiatCurrencies.findIndex(({ code }) => code === inputCurrencySymbol);
    if (inputCurrencyIndex === -1) return noPairLimitsFiatCurrencies;

    const fiatCurrenciesWithPairLimits = [...noPairLimitsFiatCurrencies];
    const inputCurrency = fiatCurrenciesWithPairLimits[inputCurrencyIndex]!;

    const { min: minAmount, max: maxAmount } = pairLimits;
    fiatCurrenciesWithPairLimits[inputCurrencyIndex] = {
      ...inputCurrency,
      minAmount,
      maxAmount
    };

    return fiatCurrenciesWithPairLimits;
  }, [noPairLimitsFiatCurrencies, pairLimits, inputCurrencySymbol]);

  return {
    noPairLimitsFiatCurrencies,
    fiatCurrenciesWithPairLimits
  };
};
