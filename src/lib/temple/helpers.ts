import { MichelCodecPacker } from '@mavrykdynamics/webmavryk';
import { ManagerKeyResponse } from '@mavrykdynamics/webmavryk-rpc';
import { validateAddress, ValidationResult } from '@mavrykdynamics/webmavryk-utils';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { FastRpcClient } from 'lib/taquito-fast-rpc';

import { TempleAccount, TempleAccountType } from './types';

export const loadFastRpcClient = memoizee((rpc: string) => new FastRpcClient(rpc), { max: 5 });

export const michelEncoder = new MichelCodecPacker();

export function loadChainId(rpcUrl: string) {
  try {
    const rpc = loadFastRpcClient(rpcUrl);

    return rpc.getChainId();
  } catch (e) {
    throw e;
  }
}

export function hasManager(manager: ManagerKeyResponse) {
  return manager && typeof manager === 'object' ? !!manager.key : !!manager;
}

export function usdToAssetAmount(
  usd?: BigNumber,
  assetUsdPrice?: number,
  assetDecimals?: number,
  roundingMode?: BigNumber.RoundingMode
) {
  return !usd || assetUsdPrice === undefined
    ? undefined
    : usd.div(assetUsdPrice).decimalPlaces(assetDecimals || 0, roundingMode ?? BigNumber.ROUND_DOWN);
}

export function tzToMumav(tz: BigNumber.Value) {
  const bigNum = new BigNumber(tz);
  if (bigNum.isNaN()) return bigNum;
  return bigNum.times(10 ** 6).integerValue();
}

export function mumavToTz(mutez: BigNumber.Value) {
  const bigNum = new BigNumber(mutez);
  if (bigNum.isNaN()) return bigNum;
  return bigNum.integerValue().div(10 ** 6);
}

export function atomsToTokens(x: BigNumber.Value, decimals: number) {
  return new BigNumber(x).integerValue().div(new BigNumber(10).pow(decimals));
}

export function tokensToAtoms(x: BigNumber.Value, decimals: number) {
  return new BigNumber(x).times(10 ** decimals).integerValue();
}

export function isAddressValid(address: string) {
  return validateAddress(address) === ValidationResult.VALID;
}

export function isKTAddress(address: string) {
  return address?.startsWith('KT');
}

export const isValidContractAddress = (address: string) => isAddressValid(address) && isKTAddress(address);

export function formatOpParamsBeforeSend(params: any) {
  if (params.kind === 'origination' && params.script) {
    const newParams = { ...params, ...params.script };
    newParams.init = newParams.storage;
    delete newParams.script;
    delete newParams.storage;
    return newParams;
  }
  return params;
}

export function getSameGroupAccounts(allAccounts: TempleAccount[], accountType: TempleAccountType, groupId?: string) {
  return allAccounts.filter(
    acc => acc.type === accountType && (acc.type !== TempleAccountType.HD || acc.walletId === groupId)
  );
}
async function pickUniqueName(
  startIndex: number,
  getNameCandidate: (i: number) => string | Promise<string>,
  isUnique: (name: string) => boolean
) {
  for (let i = startIndex; ; i++) {
    const nameCandidate = await getNameCandidate(i);
    if (isUnique(nameCandidate)) {
      return nameCandidate;
    }
  }
}

export function isNameCollision(
  allAccounts: TempleAccount[],
  accountType: TempleAccountType,
  name: string,
  walletId?: string
) {
  return getSameGroupAccounts(allAccounts, accountType, walletId).some(acc => acc.name === name);
}

export async function fetchNewAccountName(
  allAccounts: TempleAccount[],
  newAccountType: TempleAccountType,
  getNameCandidate: (i: number) => string | Promise<string>,
  newAccountWalletId?: string
) {
  const sameGroupAccounts = getSameGroupAccounts(allAccounts, newAccountType, newAccountWalletId);

  return await pickUniqueName(
    sameGroupAccounts.length + 1,
    getNameCandidate,
    name => !isNameCollision(allAccounts, newAccountType, name, newAccountWalletId)
  );
}
