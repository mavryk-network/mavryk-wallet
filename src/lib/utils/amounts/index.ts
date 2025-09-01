import BigNumber from 'bignumber.js';

import { PENNY } from 'lib/constants';
import { TempleAccount, TempleAccountType } from 'lib/temple/types';

export const formatAmountToTargetSize = (value: string | number, targetSize = 6) => {
  if (!Number.isFinite(Number(value))) return value;

  if (!Number.isInteger(targetSize) || targetSize < 1) {
    console.warn('Invalid `formatAmountToTargetSize` passed to `formatAmountToTargetSize`');
    return value;
  }

  const bn = new BigNumber(value);

  if (bn.isGreaterThanOrEqualTo(10 ** (targetSize - 1)))
    return bn.decimalPlaces(0, BigNumber.ROUND_HALF_EVEN).toString();

  return bn.toPrecision(targetSize, BigNumber.ROUND_HALF_EVEN).toString();
};

export const getMaxAmountFiat = (assetPrice: number | null, maxAmountAsset: BigNumber) =>
  assetPrice ? maxAmountAsset.times(assetPrice).decimalPlaces(2, BigNumber.ROUND_FLOOR) : new BigNumber(0);

export const getMaxAmountToken = (acc: TempleAccount, balance: BigNumber, baseFee: BigNumber, safeFeeValue: number) =>
  BigNumber.max(
    acc.type === TempleAccountType.ManagedKT
      ? balance
      : balance
          .minus(baseFee)
          .minus(safeFeeValue ?? 0)
          .minus(PENNY),
    0
  );
