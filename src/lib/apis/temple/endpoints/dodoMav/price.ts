import BigNumber from 'bignumber.js';

import { atomsToTokens } from 'lib/temple/helpers';

import { DodoMavItemType } from '../queries';

export const getPMMTokenPrice = (storage: DodoMavItemType, tokenDecimals = 6) => {
  const { fee_decimals: feeDecimals } = storage;

  const guideDecimals = new BigNumber(feeDecimals).minus(tokenDecimals);

  const decimals = new BigNumber(10).pow(new BigNumber(feeDecimals));
  const decimals12 = new BigNumber(10).pow(guideDecimals);

  // Guide price with feeDecimals adjustment
  const i = new BigNumber(storage.guide_price).div(decimals12);

  // Slippage factor adjustment
  const k = new BigNumber(storage.slippage_factor).div(decimals);

  // Base token balance
  const B = new BigNumber(storage.base_balance).div(decimals);

  // Target base token amount
  const B_0 = new BigNumber(storage.target_base_token_amount).div(decimals);

  // Quote token balance
  const Q = new BigNumber(storage.quote_balance).div(decimals);

  // Target quote token amount
  const Q_0 = new BigNumber(storage.target_quote_token_amount).div(decimals);

  // Calculate R based on the balances and slippage
  const R = calculateRFromStorage(B, B_0, Q, Q_0, k);

  // Calculate final token price
  return atomsToTokens(i.times(R), tokenDecimals);
};

export function calculateRFromStorage(
  B: BigNumber,
  B_0: BigNumber,
  Q: BigNumber,
  Q_0: BigNumber,
  k: BigNumber
): BigNumber {
  const one = new BigNumber(1);
  let R = one;

  if (B.isLessThan(B_0)) {
    // Adjust R based on the base token balance
    R = one.minus(k).plus(B_0.div(B).pow(2).times(k));
  }

  if (Q.isLessThan(Q_0)) {
    // Adjust R based on the quote token balance
    R = one.div(one.minus(k).plus(Q_0.div(Q).pow(2).times(k)));
  }

  return R;
}
