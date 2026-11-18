import { CancelledError } from '@tanstack/react-query';
import browser from 'webextension-polyfill';

import { DetailScope } from 'lib/asset-details/details.types';
import { ACCOUNT_PKH_STORAGE_KEY, CUSTOM_NETWORKS_SNAPSHOT_STORAGE_KEY } from 'lib/constants';
import { NETWORK_ID_STORAGE_KEY, normalizeNetworkId } from 'lib/temple/network-storage';
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

type StorageChange = { oldValue?: unknown; newValue?: unknown };

/** The auth wallet an account authenticates as, resolved like `getAuthWalletAddressFromStorage`. */
const getAuthWalletOf = (map: unknown, account: string) =>
  (map && typeof map === 'object' ? (map as Record<string, unknown>)[account] : undefined) ?? account;

/**
 * Whether a storage write moves the selection away from `scope`. A write that only confirms the scope (such as the
 * delayed selected-account write right after a switch, or an auth-wallet map update for other accounts) is ignored.
 */
function movesAwayFromScope(scope: DetailScope, key: string, change: StorageChange) {
  switch (key) {
    case ACCOUNT_PKH_STORAGE_KEY:
      return change.newValue !== scope.account;
    case NETWORK_ID_STORAGE_KEY:
      return normalizeNetworkId(change.newValue as string | null | undefined) !== scope.networkId;
    case MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY:
      return getAuthWalletOf(change.newValue, scope.account) !== getAuthWalletOf(change.oldValue, scope.account);
    default:
      return true;
  }
}

/**
 * The existing API resolves authentication/network from storage. Reject results across any observed
 * selection transition away from the scope (including A→B→A), without changing that reserved transport or its
 * validation.
 */
export async function withScopedWalletRequest<T>(
  scope: DetailScope,
  signal: AbortSignal | undefined,
  run: (assertScope: () => Promise<void>) => Promise<T>
): Promise<T> {
  let hasSelectionChanged = false;
  const handleStorageChanged = (changes: Record<string, StorageChange>, area: string) => {
    if (
      area === 'local' &&
      ASSET_SCOPE_STORAGE_KEYS.some(key => key in changes && movesAwayFromScope(scope, key, changes[key]))
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
    const result = await run(assertScope);
    await assertScope();
    return result;
  } finally {
    browser.storage.onChanged.removeListener(handleStorageChanged);
  }
}
