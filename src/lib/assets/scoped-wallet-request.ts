import { CancelledError } from '@tanstack/react-query';
import browser from 'webextension-polyfill';

import { DetailScope } from 'lib/asset-details/details.types';
import { ACCOUNT_PKH_STORAGE_KEY, CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY } from 'lib/constants';
import { NETWORK_ID_STORAGE_KEY } from 'lib/temple/network-storage';
import {
  getSelectedNetworkIdFromStorage,
  getWalletAddressFromStorage,
  MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY
} from 'mavryk/api/storage';

export const ASSET_SCOPE_STORAGE_KEYS = [
  ACCOUNT_PKH_STORAGE_KEY,
  CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY,
  NETWORK_ID_STORAGE_KEY,
  MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY
];

/**
 * The existing API resolves authentication/network from storage. Reject results across any observed
 * selection transition (including A→B→A), without changing that reserved transport or its validation.
 */
export async function withScopedWalletRequest<T>(
  scope: DetailScope,
  signal: AbortSignal | undefined,
  run: (assertScope: () => Promise<void>) => Promise<T>
): Promise<T> {
  let hasSelectionChanged = false;
  const handleStorageChanged = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && ASSET_SCOPE_STORAGE_KEYS.some(key => key in changes)) hasSelectionChanged = true;
  };
  const assertScope = async () => {
    const [account, networkId] = await Promise.all([getWalletAddressFromStorage(), getSelectedNetworkIdFromStorage()]);
    if (hasSelectionChanged || signal?.aborted || account !== scope.account || networkId !== scope.networkId)
      throw new CancelledError({ revert: true });
  };
  browser.storage.onChanged.addListener(handleStorageChanged);
  try {
    await assertScope();
    const result = await run(assertScope);
    await assertScope();
    return result;
  } finally {
    browser.storage.onChanged.removeListener(handleStorageChanged);
  }
}
