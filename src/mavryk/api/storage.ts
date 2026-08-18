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

export type StoredMavrykRefreshToken = ResolvedMavrykAuthStorageContext & {
  refreshToken: string;
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

  if (authContext.walletAddress) {
    await clearStoredAuthTokens({ walletAddress: authContext.walletAddress });
    return;
  }

  await clearStoredAuthTokens();
}

export async function collectStoredRefreshTokens(
  context?: MavrykAuthStorageContext
): Promise<StoredMavrykRefreshToken[]> {
  const authContext = await resolveOptionalAuthTokenContext(context);
  const storageItems = await browser.storage.local.get(null);
  const refreshTokens: StoredMavrykRefreshToken[] = [];

  Object.entries(storageItems).forEach(([storageKey, value]) => {
    if (typeof value !== 'string' || value.length === 0) return;

    if (storageKey === MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY) {
      refreshTokens.push({
        refreshToken: value,
        networkId: authContext?.networkId ?? DEFAULT_NETWORK_ID,
        walletAddress: authContext?.walletAddress ?? null
      });
      return;
    }

    const parsedStorageKey = parseAuthTokenStorageKey(storageKey);

    if (!parsedStorageKey?.isRefresh || !matchesAuthTokenContext(parsedStorageKey, authContext)) return;

    refreshTokens.push({
      refreshToken: value,
      walletAddress: parsedStorageKey.walletAddress,
      networkId: parsedStorageKey.networkId
    });
  });

  return uniqueStoredRefreshTokens(refreshTokens);
}

export async function clearStoredAuthTokens(context?: MavrykAuthStorageContext) {
  const authContext = await resolveOptionalAuthTokenContext(context);
  const storageItems = await browser.storage.local.get(null);
  const keysToRemove = [MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY, MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY];

  keysToRemove.push(
    ...Object.keys(storageItems).filter(storageKey => {
      const parsedStorageKey = parseAuthTokenStorageKey(storageKey);

      return parsedStorageKey && matchesAuthTokenContext(parsedStorageKey, authContext);
    })
  );

  await removeFromStorage(Array.from(new Set(keysToRemove)));
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

type ParsedAuthTokenStorageKey = {
  walletAddress: string;
  networkId: string;
  isRefresh: boolean;
};

type AuthTokenStorageFilter = {
  networkId?: string | null;
  walletAddress?: string | null;
};

function parseAuthTokenStorageKey(storageKey: string): ParsedAuthTokenStorageKey | null {
  const match = AUTH_TOKEN_STORAGE_KEY_PATTERN.exec(storageKey);

  if (!match) return null;

  return {
    walletAddress: match[1],
    networkId: match[2],
    isRefresh: Boolean(match[3])
  };
}

async function resolveOptionalAuthTokenContext(
  context?: MavrykAuthStorageContext
): Promise<AuthTokenStorageFilter | undefined> {
  if (!context || (context.walletAddress === undefined && context.networkId === undefined)) {
    return undefined;
  }

  return {
    walletAddress: context.walletAddress,
    networkId: context.networkId === undefined ? undefined : normalizeNetworkId(context.networkId) ?? DEFAULT_NETWORK_ID
  };
}

function matchesAuthTokenContext(storageKey: ParsedAuthTokenStorageKey, context?: AuthTokenStorageFilter) {
  if (!context) return true;

  if (context.walletAddress && storageKey.walletAddress !== context.walletAddress) {
    return false;
  }

  if (context.networkId && storageKey.networkId !== context.networkId) {
    return false;
  }

  return true;
}

function uniqueStoredRefreshTokens(tokens: StoredMavrykRefreshToken[]) {
  const seen = new Set<string>();

  return tokens.filter(token => {
    const key = [token.walletAddress ?? '', token.networkId, token.refreshToken].join('::');
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}
