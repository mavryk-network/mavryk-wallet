import { useCallback, useMemo } from 'react';

import { DEFAULT_FEE } from '@mavrykdynamics/webmavryk';
import BigNumber from 'bignumber.js';

import { ArtificialError, NotEnoughFundsError, ZeroBalanceError } from 'app/defaults';
import { PENNY, RECOMMENDED_ADD_FEE } from 'lib/constants';
import { BLOCK_DURATION } from 'lib/fixed-times';
import { useTypedSWR } from 'lib/swr';
import { ReactiveTezosToolkit } from 'lib/temple/front';
import { hasManager, mumavToTz } from 'lib/temple/helpers';
import { TempleAccount, TempleAccountType } from 'lib/temple/types';
import { delay } from 'lib/utils';

import { getBaseFeeError, getFeeError } from './utils';

export const STAKE_MODE = 'stake' as const;
export const UNSTAKE_MODE = 'unstake' as const;
export type StakeMode = typeof STAKE_MODE | typeof UNSTAKE_MODE;

export type FeeValueParams = {
  mode: StakeMode;
  balance: BigNumber; // MAV balance
  acc: TempleAccount;
  tezos: ReactiveTezosToolkit;
  feeValue?: number; // extra fee user adds
  amount: BigNumber; // stake/unstake amount entered
  decimals?: number; // MAV decimals (default 6)
};

type StakeEstimateResult = {
  baseFee: BigNumber; // base fee in MAV (burn + suggested + reveal if needed)
  est: any; // mavryk.estimate.* result (has gasLimit/storageLimit/etc)
  hasManager: boolean;
};

const floorToDecimals = (x: BigNumber, decimals: number) => x.decimalPlaces(decimals, BigNumber.ROUND_FLOOR);

export const useMavStakeFeeValue = ({
  mode,
  amount,
  balance,
  acc,
  tezos,
  feeValue = RECOMMENDED_ADD_FEE,
  decimals = 6
}: FeeValueParams) => {
  const accountPkh = acc.publicKeyHash;

  const estimateBaseFee = useCallback(async (): Promise<StakeEstimateResult | ArtificialError> => {
    try {
      if (balance.isZero()) throw new ZeroBalanceError();

      const manager = await tezos.rpc.getManagerKey(acc.type === TempleAccountType.ManagedKT ? acc.owner : accountPkh);

      const amtNum = floorToDecimals(new BigNumber(amount), decimals).toNumber();

      // If user typed something tiny (or NaN), fallback to PENNY just to avoid estimator choking
      const amountForEstimation = Number.isFinite(amtNum) && amtNum > 0 ? amtNum : Number(PENNY);

      const est =
        mode === STAKE_MODE
          ? await tezos.estimate.stake({ amount: amountForEstimation })
          : await tezos.estimate.unstake({ amount: amountForEstimation });

      let baseFee = mumavToTz(new BigNumber(est.burnFeeMumav).plus(est.suggestedFeeMumav));

      const hasMgr = hasManager(manager);
      if (!hasMgr) {
        baseFee = baseFee.plus(mumavToTz(DEFAULT_FEE.REVEAL));
      }

      // Must be able to pay fee from MAV balance
      if (baseFee.isGreaterThanOrEqualTo(balance)) {
        throw new NotEnoughFundsError();
      }

      return { baseFee, est, hasManager: hasMgr };
    } catch (err: any) {
      await delay();

      if (err instanceof ArtificialError) return err;

      console.error(err);
      throw err;
    }
  }, [mode, amount, balance, tezos, accountPkh, acc, decimals]);

  const {
    data,
    error: estimateBaseFeeError,
    isValidating: estimating
  } = useTypedSWR(
    () => (!balance.isZero() ? ['stake-base-fee', mode, tezos.checksum, accountPkh, amount.toFixed()] : null),
    estimateBaseFee,
    {
      shouldRetryOnError: false,
      focusThrottleInterval: 10_000,
      dedupingInterval: BLOCK_DURATION
    }
  );

  // keep your existing error mapping
  const baseFee = useMemo(() => {
    if (!data || data instanceof ArtificialError) return data; // ArtificialError passthrough
    return data.baseFee;
  }, [data]);

  const feeError = getBaseFeeError(baseFee as any, estimateBaseFeeError);
  const estimationError = getFeeError(estimating, feeError);

  const maxAddFee = useMemo(() => {
    if (baseFee instanceof BigNumber) {
      // max extra fee user can add while still having >= PENNY left
      return balance.minus(baseFee).minus(PENNY).toNumber();
    }
    return undefined;
  }, [balance, baseFee]);

  const safeFeeValue = useMemo(
    () => (maxAddFee != null && feeValue > maxAddFee ? maxAddFee : feeValue),
    [maxAddFee, feeValue]
  );

  const feeToUse = useMemo(() => {
    if (!(baseFee instanceof BigNumber)) return undefined;

    // CEIL fee so we never underpay by rounding
    return baseFee.plus(safeFeeValue).decimalPlaces(decimals, BigNumber.ROUND_CEIL).toNumber();
  }, [baseFee, safeFeeValue, decimals]);
  // ✅ expose estimation so caller can force gas/storage limits too
  const estimation = useMemo(() => {
    if (!data || data instanceof ArtificialError) return undefined;
    return data.est;
  }, [data]);

  return {
    estimationError,
    safeFeeValue,
    feeToUse, // number (MAV)
    baseFee, // BigNumber | ArtificialError | undefined
    estimation, // has gasLimit/storageLimit/etc
    feeError
  };
};
