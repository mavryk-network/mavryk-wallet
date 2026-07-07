import browser from 'webextension-polyfill';

import { ACCOUNT_PKH_STORAGE_KEY } from 'lib/constants';
import { fetchFromStorage, putToStorage, removeFromStorage } from 'lib/storage';
import { migrateLegacyAtlasnetStorage, NETWORK_ID_STORAGE_KEY, normalizeNetworkId } from 'lib/temple/network-storage';

export { NETWORK_ID_STORAGE_KEY };

export const DEFAULT_NETWORK_ID = 'mainnet';
export const MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY = 'mavryk_api_access_token';
export const MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY = 'mavryk_api_refresh_token';
export const MAVRYK_API_LAST_CHALLENGE_STORAGE_KEY = 'mavryk_api_last_challenge';
export const MAVRYK_API_LAST_NONCE_STORAGE_KEY = 'mavryk_api_last_nonce';
export const MAVRYK_API_LAST_CHALLENGE_EXPIRES_AT_STORAGE_KEY = 'mavryk_api_last_challenge_expires_at';
export const MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY = 'mavryk_api_auth_wallet_by_account';

export type MavrykAuthTokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
};

export type MavrykAuthStorageContext = {
  networkId?: string | null;
  walletAddress?: string | null;
};

export type ResolvedMavrykAuthStorageContext = {
  networkId: string;
  walletAddress: string | null;
};

const AUTH_TOKEN_STORAGE_KEY_PATTERN = /^\[([^\]]+)\]\[([^\]]+)\](\[refresh\])?$/;

export async function getWalletAddressFromStorage(): Promise<string | null> {
  return fetchFromStorage<string>(ACCOUNT_PKH_STORAGE_KEY);
}

/**
 * Reads the currently selected auth wallet address used for scoped auth token storage.
 */
export async function getAuthWalletAddressFromStorage(): Promise<string | null> {
  const [selectedAccountPkh, authWalletByAccount] = await Promise.all([
    fetchFromStorage<string>(ACCOUNT_PKH_STORAGE_KEY),
    fetchFromStorage<Record<string, string>>(MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY)
  ]);

  if (!selectedAccountPkh) {
    return null;
  }

  return authWalletByAccount?.[selectedAccountPkh] ?? selectedAccountPkh;
}

/**
 * Persists the lookup from account address to auth wallet address.
 */
export async function setAuthWalletAddressesMapToStorage(authWalletByAccount: Record<string, string>) {
  await putToStorage(MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY, authWalletByAccount);
}

/**
 * Resolves the wallet and network scope used for auth token storage.
 */
export async function getCurrentAuthStorageContext(
  context: MavrykAuthStorageContext = {}
): Promise<ResolvedMavrykAuthStorageContext> {
  await migrateLegacyAtlasnetStorage();

  const [walletAddress, networkId] = await Promise.all([
    context.walletAddress === undefined ? getAuthWalletAddressFromStorage() : Promise.resolve(context.walletAddress),
    context.networkId === undefined
      ? getSelectedNetworkIdFromStorage()
      : Promise.resolve(normalizeNetworkId(context.networkId) ?? null)
  ]);

  return {
    walletAddress,
    networkId: networkId ?? DEFAULT_NETWORK_ID
  };
}

export async function getSelectedNetworkIdFromStorage(): Promise<string> {
  await migrateLegacyAtlasnetStorage();

  return normalizeNetworkId(await fetchFromStorage<string>(NETWORK_ID_STORAGE_KEY)) ?? DEFAULT_NETWORK_ID;
}

export async function getAuthTokensFromStorage(context: MavrykAuthStorageContext = {}): Promise<MavrykAuthTokens> {
  const authContext = await getCurrentAuthStorageContext(context);

  if (!authContext.walletAddress) {
    return { accessToken: null, refreshToken: null };
  }

  const [storedAccessToken, storedRefreshToken] = await Promise.all([
    fetchFromStorage<string>(buildAccessTokenStorageKey(authContext.walletAddress, authContext.networkId)),
    fetchFromStorage<string>(buildRefreshTokenStorageKey(authContext.walletAddress, authContext.networkId))
  ]);
  const accessToken = storedAccessToken ?? null;
  const refreshToken = storedRefreshToken ?? null;

  if (accessToken !== null || refreshToken !== null) {
    return { accessToken, refreshToken };
  }

  const [storedLegacyAccessToken, storedLegacyRefreshToken] = await Promise.all([
    fetchFromStorage<string>(MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY),
    fetchFromStorage<string>(MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY)
  ]);
  const legacyAccessToken = storedLegacyAccessToken ?? null;
  const legacyRefreshToken = storedLegacyRefreshToken ?? null;

  if (legacyAccessToken === null && legacyRefreshToken === null) {
    return { accessToken, refreshToken };
  }

  await setAuthTokensToStorage(
    {
      accessToken: legacyAccessToken,
      refreshToken: legacyRefreshToken
    },
    authContext
  );
  await removeFromStorage([MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY, MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY]);

  return { accessToken: legacyAccessToken, refreshToken: legacyRefreshToken };
}

export async function setAuthTokensToStorage(tokens: MavrykAuthTokens, context: MavrykAuthStorageContext = {}) {
  const authContext = await getCurrentAuthStorageContext(context);

  if (!authContext.walletAddress) {
    throw new Error('No auth wallet address in storage');
  }

  const valuesToSet: Record<string, string | null> = {};

  if (tokens.accessToken !== undefined) {
    valuesToSet[buildAccessTokenStorageKey(authContext.walletAddress, authContext.networkId)] =
      tokens.accessToken ?? null;
  }

  if (tokens.refreshToken !== undefined) {
    valuesToSet[buildRefreshTokenStorageKey(authContext.walletAddress, authContext.networkId)] =
      tokens.refreshToken ?? null;
  }

  if (Object.keys(valuesToSet).length > 0) {
    await browser.storage.local.set(valuesToSet);
  }
}

export async function clearAuthTokensFromStorage(context: MavrykAuthStorageContext = {}) {
  const authContext = await getCurrentAuthStorageContext(context);
  const keysToRemove = [MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY, MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY];

  if (authContext.walletAddress) {
    keysToRemove.push(
      buildAccessTokenStorageKey(authContext.walletAddress, authContext.networkId),
      buildRefreshTokenStorageKey(authContext.walletAddress, authContext.networkId)
    );
  }

  await removeFromStorage(keysToRemove);
}

export async function clearAllAuthTokensFromStorage(context: MavrykAuthStorageContext = {}) {
  const authContext = await getCurrentAuthStorageContext(context);
  const keysToRemove = [MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY, MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY];

  if (authContext.walletAddress) {
    const walletAddress = authContext.walletAddress;
    const storageItems = await browser.storage.local.get(null);
    keysToRemove.push(
      ...Object.keys(storageItems).filter(storageKey => isAuthTokenStorageKeyForWallet(storageKey, walletAddress))
    );
  }

  await removeFromStorage(keysToRemove);
}

export async function getLastChallengeFromStorage(): Promise<string | null> {
  return fetchFromStorage<string>(MAVRYK_API_LAST_CHALLENGE_STORAGE_KEY);
}

export async function getLastNonceFromStorage(): Promise<string | null> {
  return fetchFromStorage<string>(MAVRYK_API_LAST_NONCE_STORAGE_KEY);
}

export async function getLastChallengeExpiresAtFromStorage(): Promise<string | null> {
  return fetchFromStorage<string>(MAVRYK_API_LAST_CHALLENGE_EXPIRES_AT_STORAGE_KEY);
}

export async function setLastChallengeToStorage(params: {
  challenge: string | null;
  nonce?: string | null;
  expiresAt?: string | null;
}) {
  const ops: Promise<unknown>[] = [putToStorage(MAVRYK_API_LAST_CHALLENGE_STORAGE_KEY, params.challenge)];

  if (params.nonce !== undefined) {
    ops.push(putToStorage(MAVRYK_API_LAST_NONCE_STORAGE_KEY, params.nonce ?? null));
  }

  if (params.expiresAt !== undefined) {
    ops.push(putToStorage(MAVRYK_API_LAST_CHALLENGE_EXPIRES_AT_STORAGE_KEY, params.expiresAt ?? null));
  }

  await Promise.all(ops);
}

function buildAccessTokenStorageKey(walletAddress: string, networkId: string) {
  return `[${walletAddress}][${networkId}]`;
}

function buildRefreshTokenStorageKey(walletAddress: string, networkId: string) {
  return `[${walletAddress}][${networkId}][refresh]`;
}

function isAuthTokenStorageKeyForWallet(storageKey: string, walletAddress: string) {
  const match = AUTH_TOKEN_STORAGE_KEY_PATTERN.exec(storageKey);

  return match?.[1] === walletAddress;
}
