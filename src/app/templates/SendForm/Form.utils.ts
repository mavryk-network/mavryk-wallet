import { DEFAULT_FEE, TransferParams, Estimate } from '@mavrykdynamics/webmavryk';
import { ManagerKeyResponse } from '@mavrykdynamics/webmavryk-rpc';
import BigNumber from 'bignumber.js';

import { transferImplicit, transferToContract } from 'lib/michelson';
import { loadContract } from 'lib/temple/contract';
import { ReactiveTezosToolkit } from 'lib/temple/front';
import { hasManager, isKTAddress, mumavToTz, tzToMumav } from 'lib/temple/helpers';
import { TempleAccountType, TempleAccount, TempleNetworkType } from 'lib/temple/types';

export type TransferParamsInvariant =
  | TransferParams
  | {
      to: string;
      amount: any; // SDK type mismatch — TransferParams.amount is number but strings are passed at runtime
    };

export const estimateMaxFee = async (
  acc: TempleAccount,
  tez: boolean,
  tezos: ReactiveTezosToolkit,
  to: string,
  balanceBN: BigNumber,
  transferParams: TransferParamsInvariant,
  manager: ManagerKeyResponse
) => {
  let estmtnMax: Estimate;
  if (acc.type === TempleAccountType.ManagedKT) {
    const michelsonLambda = isKTAddress(to) ? transferToContract : transferImplicit;
    const contract = await loadContract(tezos, acc.publicKeyHash);
    const transferParamsWrapper = contract.methods.do(michelsonLambda(to, tzToMumav(balanceBN))).toTransferParams();
    estmtnMax = await tezos.estimate.transfer(transferParamsWrapper);
  } else if (tez) {
    const estmtn = await tezos.estimate.transfer(transferParams);
    let amountMax = balanceBN.minus(mumavToTz(estmtn.totalCost));
    if (!hasManager(manager)) {
      amountMax = amountMax.minus(mumavToTz(DEFAULT_FEE.REVEAL));
    }
    estmtnMax = await tezos.estimate.transfer({
      to,
      amount: amountMax.toString() as any
    });
  } else {
    estmtnMax = await tezos.estimate.transfer(transferParams);
  }
  return estmtnMax;
};

export const getAssetPriceByNetwork = (network: TempleNetworkType, assetPrice: number | null) =>
  network === 'main' && assetPrice !== null;

export const getEstimateFallBackDisplayed = (toFilled: boolean, baseFee: unknown, estimating: boolean) =>
  toFilled && !baseFee && estimating;

export const getRestFormDisplayed = (toFilled: boolean, baseFee: unknown, estimationError: unknown) =>
  Boolean(toFilled && (baseFee || estimationError));

export const getFilled = (toFilled: boolean, toFieldFocused: boolean) => (!toFilled ? toFieldFocused : false);
