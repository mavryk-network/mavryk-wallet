import { ACCOUNT_PKH_STORAGE_KEY } from 'lib/constants';
import { fetchFromStorage, putToStorage, removeFromStorage } from 'lib/storage';

export const MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY = 'mavryk_api_access_token';
export const MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY = 'mavryk_api_refresh_token';
export const MAVRYK_API_LAST_CHALLENGE_STORAGE_KEY = 'mavryk_api_last_challenge';
export const MAVRYK_API_LAST_NONCE_STORAGE_KEY = 'mavryk_api_last_nonce';
export const MAVRYK_API_LAST_CHALLENGE_EXPIRES_AT_STORAGE_KEY = 'mavryk_api_last_challenge_expires_at';

export type MavrykAuthTokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
};

export async function getWalletAddressFromStorage(): Promise<string | null> {
  return fetchFromStorage<string>(ACCOUNT_PKH_STORAGE_KEY);
}

export async function getAuthTokensFromStorage(): Promise<MavrykAuthTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    fetchFromStorage<string>(MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY),
    fetchFromStorage<string>(MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY)
  ]);

  return { accessToken, refreshToken };
}

export async function setAuthTokensToStorage(tokens: MavrykAuthTokens) {
  const ops: Promise<unknown>[] = [];

  if (tokens.accessToken !== undefined) {
    ops.push(putToStorage(MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken ?? null));
  }

  if (tokens.refreshToken !== undefined) {
    ops.push(putToStorage(MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken ?? null));
  }

  await Promise.all(ops);
}

export async function clearAuthTokensFromStorage() {
  await removeFromStorage([MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY, MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY]);
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
