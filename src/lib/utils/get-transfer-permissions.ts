import { MavrykToolkit, TransferParams } from '@mavrykdynamics/taquito';
import { BigNumber } from 'bignumber.js';

import { ZERO } from 'lib/utils/numbers';

interface TokenToSpend {
  contract: string | null;
  tokenId: string | number | null;
  standard: 'fa12' | 'fa2' | 'xtz';
}

export const getTransferPermissions = async (
  tezos: MavrykToolkit,
  spender: string,
  owner: string,
  tokenToSpend: TokenToSpend,
  amountAtomic: BigNumber
) => {
  const permissions: { approve: Array<TransferParams>; revoke: Array<TransferParams> } = {
    approve: [],
    revoke: []
  };

  if (!tokenToSpend.contract) {
    return permissions;
  }

  const assetContract = await tezos.wallet.at(tokenToSpend.contract);
  if (tokenToSpend.standard === 'fa12') {
    const reset = assetContract.methods.approve(spender, ZERO).toTransferParams({ mumav: true });
    const spend = assetContract.methods.approve(spender, amountAtomic).toTransferParams({ mumav: true });
    permissions.approve.push(reset);
    permissions.approve.push(spend);
  } else {
    const spend = assetContract.methods
      .update_operators([
        {
          add_operator: {
            owner,
            operator: spender,
            token_id: tokenToSpend.tokenId
          }
        }
      ])
      .toTransferParams({ mumav: true });
    const reset = assetContract.methods
      .update_operators([
        {
          remove_operator: {
            owner,
            operator: spender,
            token_id: tokenToSpend.tokenId
          }
        }
      ])
      .toTransferParams({ mumav: true });

    permissions.approve.push(spend);
    permissions.revoke.push(reset);
  }

  return permissions;
};
