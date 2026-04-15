import { useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
import BigNumber from 'bignumber.js';

import { MvktUserAccount } from 'lib/apis/mvkt/types';
import { isMavSlug, MAV_TOKEN_SLUG } from 'lib/assets';
import { useEnabledAccountTokensSlugs } from 'lib/assets/hooks';
import { useEnabledOtherAccountTokensSlugs } from 'lib/assets/hooks/tokens';
import {
  useGetCurrentAccountTokenOrGasBalanceWithDecimals,
  useGetOtherAccountTokenOrGasBalanceWithDecimals
} from 'lib/balances/hooks';
import { useUsdToTokenRates } from 'lib/fiat-currency';
import { useGasTokenMetadata } from 'lib/metadata';
import { useAccount, useDelegate } from 'lib/temple/front';
import { atomsToTokens } from 'lib/temple/helpers';
import { isTruthy } from 'lib/utils';
import { ZERO } from 'lib/utils/numbers';

/** Total balance in dollar value of displayed tokens, taken from store */
export const useTotalBalance = (isStakingBalanceIncluded = false) => {
  const { publicKeyHash } = useAccount();
  const tokensSlugs = useEnabledAccountTokensSlugs();
  const { data: accStats } = useDelegate(publicKeyHash);
  const metadata = useGasTokenMetadata();

  const getBalance = useGetCurrentAccountTokenOrGasBalanceWithDecimals();
  const allUsdToTokenRates = useUsdToTokenRates();

  const slugs = useMemo(() => [MAV_TOKEN_SLUG, ...tokensSlugs], [tokensSlugs]);

  return useMemo(() => {
    let dollarValue = ZERO;

    for (const slug of slugs) {
      let balance = getBalance(slug);

      if (isStakingBalanceIncluded && isMavSlug(slug)) {
        balance = upgradeBalanceWithStakingBalance(balance, accStats, metadata.decimals);
      }

      const usdToTokenRate = allUsdToTokenRates[slug];
      const tokenDollarValue = isDefined(balance) && isTruthy(usdToTokenRate) ? balance.times(usdToTokenRate) : 0;
      dollarValue = dollarValue.plus(tokenDollarValue);
    }

    return dollarValue.toString();
  }, [slugs, getBalance, isStakingBalanceIncluded, allUsdToTokenRates, accStats, metadata.decimals]);
};

export const useOtherAccountTotalBalance = (accountPkh: string, isStakingBalanceIncluded = false) => {
  const { data: accStats } = useDelegate(accountPkh);
  const metadata = useGasTokenMetadata();
  const tokensSlugs = useEnabledOtherAccountTokensSlugs(accountPkh);

  const getBalance = useGetOtherAccountTokenOrGasBalanceWithDecimals(accountPkh);
  const allUsdToTokenRates = useUsdToTokenRates();

  const slugs = useMemo(() => [MAV_TOKEN_SLUG, ...tokensSlugs], [tokensSlugs]);

  return useMemo(() => {
    let dollarValue = ZERO;

    for (const slug of slugs) {
      let balance = getBalance(slug);

      if (isStakingBalanceIncluded && isMavSlug(slug)) {
        balance = upgradeBalanceWithStakingBalance(balance, accStats, metadata.decimals);
      }
      const usdToTokenRate = allUsdToTokenRates[slug];
      const tokenDollarValue = isDefined(balance) && isTruthy(usdToTokenRate) ? balance.times(usdToTokenRate) : 0;
      dollarValue = dollarValue.plus(tokenDollarValue);
    }

    return dollarValue.toString();
  }, [slugs, getBalance, isStakingBalanceIncluded, allUsdToTokenRates, accStats, metadata.decimals]);
};

export const upgradeBalanceWithStakingBalance = (balance?: BigNumber, acc?: MvktUserAccount, decimals = 6) => {
  const stakedBalance = atomsToTokens(acc?.stakedBalance ?? ZERO, decimals);
  const unstakedBalance = atomsToTokens(acc?.unstakedBalance ?? ZERO, decimals);

  return balance?.plus(stakedBalance)?.plus(unstakedBalance);
};
