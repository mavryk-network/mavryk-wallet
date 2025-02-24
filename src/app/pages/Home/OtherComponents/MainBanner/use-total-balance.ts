import { useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';

import { useSelector } from 'app/store/root-state.selector';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { useEnabledAccountTokensSlugs } from 'lib/assets/hooks';
import { useEnabledOtherAccountTokensSlugs } from 'lib/assets/hooks/tokens';
import {
  useGetCurrentAccountTokenOrGasBalanceWithDecimals,
  useGetOtherAccountTokenOrGasBalanceWithDecimals
} from 'lib/balances/hooks';
import { isTruthy } from 'lib/utils';
import { ZERO } from 'lib/utils/numbers';

/** Total balance in dollar value of displayed tokens, taken from store */
export const useTotalBalance = () => {
  const tokensSlugs = useEnabledAccountTokensSlugs();

  const getBalance = useGetCurrentAccountTokenOrGasBalanceWithDecimals();
  const allUsdToTokenRates = useSelector(state => state.currency.usdToTokenRates.data);

  const slugs = useMemo(() => [MAV_TOKEN_SLUG, ...tokensSlugs], [tokensSlugs]);

  return useMemo(() => {
    let dollarValue = ZERO;

    for (const slug of slugs) {
      const balance = getBalance(slug);
      const usdToTokenRate = allUsdToTokenRates[slug];
      const tokenDollarValue = isDefined(balance) && isTruthy(usdToTokenRate) ? balance.times(usdToTokenRate) : 0;
      dollarValue = dollarValue.plus(tokenDollarValue);
    }

    return dollarValue.toString();
  }, [slugs, getBalance, allUsdToTokenRates]);
};

export const useOtherAccountTotalBalance = (accountPkh: string) => {
  const tokensSlugs = useEnabledOtherAccountTokensSlugs(accountPkh);

  const getBalance = useGetOtherAccountTokenOrGasBalanceWithDecimals(accountPkh);
  const allUsdToTokenRates = useSelector(state => state.currency.usdToTokenRates.data);

  const slugs = useMemo(() => [MAV_TOKEN_SLUG, ...tokensSlugs], [tokensSlugs]);

  return useMemo(() => {
    let dollarValue = ZERO;

    for (const slug of slugs) {
      const balance = getBalance(slug);
      const usdToTokenRate = allUsdToTokenRates[slug];
      const tokenDollarValue = isDefined(balance) && isTruthy(usdToTokenRate) ? balance.times(usdToTokenRate) : 0;
      dollarValue = dollarValue.plus(tokenDollarValue);
    }

    return dollarValue.toString();
  }, [slugs, getBalance, allUsdToTokenRates]);
};
