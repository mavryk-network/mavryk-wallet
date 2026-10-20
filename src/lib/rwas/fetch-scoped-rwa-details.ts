import { DetailScope } from 'lib/asset-details/details.types';
import { isRwaTokenException } from 'lib/assets/rwa-classification';
import { withScopedWalletRequest } from 'lib/assets/scoped-wallet-request';
import { toTokenSlug } from 'lib/assets/utils';
import { fetchWalletRwaAssets, walletRwaAssetToDetails } from 'mavryk/api/rwas';

import type { RwaDetailsRecord } from './details.types';

/** Discard responses across storage selection changes, including A→B→A transitions. */
export async function fetchScopedRwaDetails(scope: DetailScope, signal?: AbortSignal): Promise<RwaDetailsRecord> {
  return withScopedWalletRequest(scope, signal, async () => {
    const assets = await fetchWalletRwaAssets({ walletAddress: scope.account });
    const details: RwaDetailsRecord = {};
    for (const asset of assets) {
      const slug = toTokenSlug(asset.address, 0);
      if (!isRwaTokenException(slug, scope.chainId)) details[slug] = walletRwaAssetToDetails(asset);
    }
    return details;
  });
}
