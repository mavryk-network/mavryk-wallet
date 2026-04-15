import { useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';

import { useCryptoCurrencies } from 'lib/buy-with-credit-card/use-buy-with-credit-card.query';
import { TopUpProviderId } from 'lib/buy-with-credit-card/top-up-provider-id.enum';
import { TopUpOutputInterface } from 'lib/buy-with-credit-card/topup.interface';

export const useAllCryptoCurrencies = () => {
  const moonpayCryptoCurrencies = useCryptoCurrencies(TopUpProviderId.MoonPay);
  const utorgCryptoCurrencies = useCryptoCurrencies(TopUpProviderId.Utorg);
  const aliceBobCryptoCurrencies = useCryptoCurrencies(TopUpProviderId.AliceBob);

  return useMemo(
    () =>
      Object.values(
        [...moonpayCryptoCurrencies, ...utorgCryptoCurrencies, ...aliceBobCryptoCurrencies].reduce<
          Record<string, TopUpOutputInterface>
        >((acc, currency) => {
          if (!isDefined(acc[currency.code])) {
            acc[currency.code] = currency;
          }

          return acc;
        }, {})
      ).sort(({ code: aCode }, { code: bCode }) => aCode.localeCompare(bCode)),
    [moonpayCryptoCurrencies, utorgCryptoCurrencies, aliceBobCryptoCurrencies]
  );
};
