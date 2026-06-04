import { ACCOUNT_PKH_STORAGE_KEY } from 'lib/constants';
import { fetchFromStorage, putToStorage, removeFromStorage } from 'lib/storage';

export const NETWORK_ID_STORAGE_KEY = 'network_id';
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
): Promise<Required<MavrykAuthStorageContext>> {
  const [walletAddress, networkId] = await Promise.all([
    context.walletAddress === undefined ? getAuthWalletAddressFromStorage() : Promise.resolve(context.walletAddress),
    context.networkId === undefined ? getSelectedNetworkIdFromStorage() : Promise.resolve(context.networkId ?? null)
  ]);

  return {
    walletAddress,
    networkId: networkId ?? DEFAULT_NETWORK_ID
  };
}

export async function getSelectedNetworkIdFromStorage(): Promise<string> {
  return (await fetchFromStorage<string>(NETWORK_ID_STORAGE_KEY)) ?? DEFAULT_NETWORK_ID;
}

export async function getAuthTokensFromStorage(context: MavrykAuthStorageContext = {}): Promise<MavrykAuthTokens> {
  const authContext = await getCurrentAuthStorageContext(context);

  if (!authContext.walletAddress) {
    return { accessToken: null, refreshToken: null };
  }

  const [accessToken, refreshToken] = await Promise.all([
    fetchFromStorage<string>(buildAccessTokenStorageKey(authContext.walletAddress, authContext.networkId)),
    fetchFromStorage<string>(buildRefreshTokenStorageKey(authContext.walletAddress, authContext.networkId))
  ]);

  if (accessToken !== null || refreshToken !== null) {
    return { accessToken, refreshToken };
  }

  const [legacyAccessToken, legacyRefreshToken] = await Promise.all([
    fetchFromStorage<string>(MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY),
    fetchFromStorage<string>(MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY)
  ]);

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

  const ops: Promise<unknown>[] = [];

  if (tokens.accessToken !== undefined) {
    ops.push(
      putToStorage(
        buildAccessTokenStorageKey(authContext.walletAddress, authContext.networkId),
        tokens.accessToken ?? null
      )
    );
  }

  if (tokens.refreshToken !== undefined) {
    ops.push(
      putToStorage(
        buildRefreshTokenStorageKey(authContext.walletAddress, authContext.networkId),
        tokens.refreshToken ?? null
      )
    );
  }

  await Promise.all(ops);
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
