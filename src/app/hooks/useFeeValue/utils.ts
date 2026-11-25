import { DEFAULT_FEE, Estimate, TransferParams } from '@mavrykdynamics/webmavryk';
import { ManagerKeyResponse } from '@mavrykdynamics/webmavryk-rpc';
import BigNumber from 'bignumber.js';

import { ArtificialError } from 'app/defaults';
import { transferImplicit, transferToContract } from 'lib/michelson';
import { loadContract } from 'lib/temple/contract';
import { ReactiveTezosToolkit } from 'lib/temple/front';
import { hasManager, isKTAddress, mumavToTz, tzToMumav } from 'lib/temple/helpers';
import { TempleAccount, TempleAccountType } from 'lib/temple/types';

export type TransferParamsInvariant =
  | TransferParams
  | {
      to: string;
      amount: any;
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

export const getBaseFeeError = (baseFee: BigNumber | ArtificialError | undefined, estimateBaseFeeError: any) =>
  baseFee instanceof Error ? baseFee : estimateBaseFeeError;

export const getFeeError = (estimating: boolean, feeError: any) => (!estimating ? feeError : null);
