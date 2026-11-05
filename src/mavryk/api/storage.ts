import { browser } from 'lib/browser';
import { ACCOUNT_PKH_STORAGE_KEY } from 'lib/constants';
import { fetchFromStorage, putToStorage } from 'lib/storage';
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
const LEGACY_AUTH_TOKEN_STORAGE_KEYS = [MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY, MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY];

type StorageArea = typeof browser.storage.local;
type SessionStorageArea = StorageArea & {
  setAccessLevel?: (accessInfo: {
    accessLevel: 'TRUSTED_CONTEXTS' | 'TRUSTED_AND_UNTRUSTED_CONTEXTS';
  }) => Promise<void>;
};

/**
 * Auth tokens live in `storage.session`: it is wiped when the browser closes and, at `TRUSTED_CONTEXTS`, is not
 * readable by content scripts. Extension pages still read it directly through the shared API client.
 * Falls back to `storage.local` only where `storage.session` doesn't exist.
 */
function getAuthTokenStorageArea(): StorageArea {
  return browser.storage.session ?? browser.storage.local;
}

/** Every area that may hold auth tokens, so clean-up and revocation also catch copies left in `storage.local`. */
function getAuthTokenStorageAreas(): StorageArea[] {
  const area = getAuthTokenStorageArea();
  return area === browser.storage.local ? [area] : [area, browser.storage.local];
}

const isAuthTokenStorageKey = (storageKey: string) =>
  LEGACY_AUTH_TOKEN_STORAGE_KEYS.includes(storageKey) || parseAuthTokenStorageKey(storageKey) !== null;

/**
 * One-time move of auth tokens from `storage.local` to `storage.session`, run by the background at start.
 * Restricts `storage.session` to trusted contexts first. A key already present in session storage is newer than
 * the local copy and is kept. Local copies are deleted either way.
 */
export async function migrateAuthTokensToSessionStorage() {
  const sessionArea: SessionStorageArea | undefined = browser.storage.session;
  if (!sessionArea) return;

  try {
    await sessionArea.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
  } catch (error) {
    console.error(error);
  }

  const localItems = await browser.storage.local.get(null);
  const localTokenKeys = Object.keys(localItems).filter(isAuthTokenStorageKey);
  if (localTokenKeys.length === 0) return;

  const sessionItems = await sessionArea.get(localTokenKeys);
  const valuesToMove = Object.fromEntries(
    localTokenKeys
      .filter(key => !(key in sessionItems) && typeof localItems[key] === 'string')
      .map(key => [key, localItems[key]])
  );

  if (Object.keys(valuesToMove).length > 0) await sessionArea.set(valuesToMove);
  await browser.storage.local.remove(localTokenKeys);
}

async function fetchAuthTokenFromStorage(key: string): Promise<string | null> {
  const items = await getAuthTokenStorageArea().get([key]);
  return typeof items[key] === 'string' ? items[key] : null;
}

async function getAllAuthTokenStorageItems(): Promise<Record<string, unknown>> {
  const itemsByArea = await Promise.all(getAuthTokenStorageAreas().map(area => area.get(null)));
  // The primary area wins over leftovers in storage.local
  return Object.assign({}, ...itemsByArea.reverse());
}

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
 * Auth context for a wallet-scoped read of `accountAddress`: its own auth wallet (via the account → auth wallet
 * map) on the selected network. Unlike the default context it never follows the selected account, so a read
 * started right after an account switch cannot carry the previous account's token.
 */
export async function getAuthStorageContextForAccount(
  accountAddress: string
): Promise<ResolvedMavrykAuthStorageContext> {
  const authWalletByAccount = await fetchFromStorage<Record<string, string>>(
    MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY
  );

  return getCurrentAuthStorageContext({ walletAddress: authWalletByAccount?.[accountAddress] ?? accountAddress });
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

  const [accessToken, refreshToken] = await Promise.all([
    fetchAuthTokenFromStorage(buildAccessTokenStorageKey(authContext.walletAddress, authContext.networkId)),
    fetchAuthTokenFromStorage(buildRefreshTokenStorageKey(authContext.walletAddress, authContext.networkId))
  ]);

  if (accessToken !== null || refreshToken !== null) {
    return { accessToken, refreshToken };
  }

  const [legacyAccessToken, legacyRefreshToken] = await Promise.all([
    fetchAuthTokenFromStorage(MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY),
    fetchAuthTokenFromStorage(MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY)
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
  await removeAuthTokensFromStorage(LEGACY_AUTH_TOKEN_STORAGE_KEYS);

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
    await getAuthTokenStorageArea().set(valuesToSet);
  }
}

async function removeAuthTokensFromStorage(keys: string[]) {
  await Promise.all(getAuthTokenStorageAreas().map(area => area.remove(keys)));
}

export async function clearAuthTokensFromStorage(context: MavrykAuthStorageContext = {}) {
  const authContext = await getCurrentAuthStorageContext(context);
  const keysToRemove = [...LEGACY_AUTH_TOKEN_STORAGE_KEYS];

  if (authContext.walletAddress) {
    keysToRemove.push(
      buildAccessTokenStorageKey(authContext.walletAddress, authContext.networkId),
      buildRefreshTokenStorageKey(authContext.walletAddress, authContext.networkId)
    );
  }

  await removeAuthTokensFromStorage(keysToRemove);
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
  const storageItems = await getAllAuthTokenStorageItems();
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
  const storageItems = await getAllAuthTokenStorageItems();
  const keysToRemove = [...LEGACY_AUTH_TOKEN_STORAGE_KEYS];

  keysToRemove.push(
    ...Object.keys(storageItems).filter(storageKey => {
      const parsedStorageKey = parseAuthTokenStorageKey(storageKey);

      return parsedStorageKey && matchesAuthTokenContext(parsedStorageKey, authContext);
    })
  );

  await removeAuthTokensFromStorage(Array.from(new Set(keysToRemove)));
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

// Brackets (and '%', the escape character) are percent-encoded in key segments so every key parses back
// with AUTH_TOKEN_STORAGE_KEY_PATTERN (and so can be revoked and cleared on lock/logout) and no scope can alias
// another scope's slot. Custom network ids are raw RPC URLs, which may legitimately contain brackets (IPv6).
function encodeAuthTokenStorageKeySegment(segment: string) {
  return segment.replace(/[%[\]]/g, encodeURIComponent);
}

function decodeAuthTokenStorageKeySegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function buildAccessTokenStorageKey(walletAddress: string, networkId: string) {
  return `[${encodeAuthTokenStorageKeySegment(walletAddress)}][${encodeAuthTokenStorageKeySegment(networkId)}]`;
}

function buildRefreshTokenStorageKey(walletAddress: string, networkId: string) {
  return `${buildAccessTokenStorageKey(walletAddress, networkId)}[refresh]`;
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
    walletAddress: decodeAuthTokenStorageKeySegment(match[1]),
    networkId: decodeAuthTokenStorageKeySegment(match[2]),
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
