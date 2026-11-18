import { MavrykToolkit } from '@mavrykdynamics/webmavryk';
import BigNumber from 'bignumber.js';

import { isFA2Token, MAV_TOKEN_SLUG } from 'lib/assets';
import { fromAssetSlugWithStandardDetect } from 'lib/assets/contract.utils';
import { loadContract } from 'lib/temple/contract';

/** RPC failures and malformed views remain errors; only a validated zero represents an empty balance. */
export const fetchRawBalance = async (tezos: MavrykToolkit, assetSlug: string, account: string) => {
  const asset = await fromAssetSlugWithStandardDetect(tezos, assetSlug);
  if (asset === MAV_TOKEN_SLUG) return toBalance(await tezos.mv.getBalance(account));
  const contract = await loadContract(tezos, asset.contract, false);
  if (isFA2Token(asset)) {
    const response = await contract.views.balance_of([{ owner: account, token_id: asset.id }]).read();
    if (!Array.isArray(response) || response.length !== 1) throw new Error('Invalid balance view response');
    return toBalance(response[0]?.balance);
  }
  return toBalance(await contract.views.getBalance(account).read());
};

function toBalance(value: unknown): BigNumber {
  if (
    !(
      typeof value === 'string' ||
      BigNumber.isBigNumber(value) ||
      (typeof value === 'number' && Number.isSafeInteger(value))
    )
  )
    throw new Error('Invalid RPC balance');
  const balance = new BigNumber(value);
  if (!balance.isFinite() || balance.isNegative()) throw new Error('Invalid RPC balance');
  return balance;
}
