import { CancelledError } from '@tanstack/react-query';
import browser from 'webextension-polyfill';

import { DetailScope } from 'lib/asset-details/details.types';
import { toTokenSlug } from 'lib/assets/utils';
import { ACCOUNT_PKH_STORAGE_KEY } from 'lib/constants';
import { NETWORK_ID_STORAGE_KEY } from 'lib/temple/network-storage';
import { fetchWalletRwaAssets, walletRwaAssetToDetails } from 'mavryk/api/rwas';
import {
  getSelectedNetworkIdFromStorage,
  getWalletAddressFromStorage,
  MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY
} from 'mavryk/api/storage';

import type { RwaDetailsRecord } from './details.types';

/**
 * The existing API resolves authentication/network from storage. Reject results across any observed
 * selection transition (including A→B→A), without changing that reserved transport or its validation.
 */
export async function fetchScopedRwaDetails(scope: DetailScope, signal?: AbortSignal): Promise<RwaDetailsRecord> {
  let hasSelectionChanged = false;
  const handleStorageChanged = (changes: Record<string, unknown>, area: string) => {
    if (
      area === 'local' &&
      [ACCOUNT_PKH_STORAGE_KEY, NETWORK_ID_STORAGE_KEY, MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY].some(
        key => key in changes
      )
    )
      hasSelectionChanged = true;
  };
  const assertScope = async () => {
    const [account, networkId] = await Promise.all([getWalletAddressFromStorage(), getSelectedNetworkIdFromStorage()]);
    if (hasSelectionChanged || signal?.aborted || account !== scope.account || networkId !== scope.networkId)
      throw new CancelledError({ revert: true });
  };
  browser.storage.onChanged.addListener(handleStorageChanged);
  try {
    await assertScope();
    const assets = await fetchWalletRwaAssets({ walletAddress: scope.account });
    await assertScope();
    const details: RwaDetailsRecord = {};
    for (const asset of assets) details[toTokenSlug(asset.address, 0)] = walletRwaAssetToDetails(asset);
    return details;
  } finally {
    browser.storage.onChanged.removeListener(handleStorageChanged);
  }
}
