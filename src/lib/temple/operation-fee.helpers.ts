import BigNumber from 'bignumber.js';

/**
 * Sums the baker fee over every content of an operation group, reveal included.
 *
 * @param contents preapplied or injected contents of one operation group
 * @returns the total fee in mumav; contents without a numeric fee count as zero
 */
export const sumOperationFeesMumav = (contents: ReadonlyArray<object>): BigNumber =>
  contents.reduce<BigNumber>((total, content) => {
    const fee: unknown = 'fee' in content ? content.fee : undefined;
    if (typeof fee !== 'string' && typeof fee !== 'number') return total;
    const value = new BigNumber(fee);
    return value.isFinite() ? total.plus(value) : total;
  }, new BigNumber(0));
