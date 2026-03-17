import { z } from 'zod';

import { mavrykApi } from './client';
import { isJwtExpiringSoon } from './jwt';
import {
  clearAuthTokensFromStorage,
  getAuthTokensFromStorage,
  getLastNonceFromStorage,
  getWalletAddressFromStorage,
  setAuthTokensToStorage,
  setLastChallengeToStorage
} from './storage';

const AuthChallengeResponseSchema = z.object({
  challenge: z.string(),
  expiresAt: z.string(),
  nonce: z.string()
});

const AuthVerifyResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string()
});

const AuthRefreshResponseSchema = z.object({
  accessToken: z.string()
});

export type AuthChallengeResponse = z.infer<typeof AuthChallengeResponseSchema>;
export type AuthVerifyResponse = z.infer<typeof AuthVerifyResponseSchema>;
export type AuthRefreshResponse = z.infer<typeof AuthRefreshResponseSchema>;

export type AuthChallengeRequest = {
  walletAddress?: string;
};

export type AuthVerifyRequest = {
  deviceInfo?: Record<string, unknown>;
  nonce?: string;
  signature: string;
  walletAddress?: string;
};

export type AuthRefreshRequest = {
  refreshToken?: string;
};

const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 60_000;

async function getWalletAddressOrThrow(walletAddress?: string) {
  const stored = walletAddress ?? (await getWalletAddressFromStorage());
  if (!stored) throw new Error('No wallet address in storage');
  return stored;
}

export async function requestAuthChallenge(params: AuthChallengeRequest = {}) {
  const address = await getWalletAddressOrThrow(params.walletAddress);

  const { data } = await mavrykApi.post<AuthChallengeResponse>('/auth/challenge', {
    walletAddress: address
  });

  const parsed = AuthChallengeResponseSchema.parse(data);
  await setLastChallengeToStorage({
    challenge: parsed.challenge,
    nonce: parsed.nonce,
    expiresAt: parsed.expiresAt
  });

  return parsed;
}

export async function verifyAuthSignature(payload: AuthVerifyRequest) {
  const address = await getWalletAddressOrThrow(payload.walletAddress);
  const nonce = payload.nonce ?? (await getLastNonceFromStorage()) ?? undefined;

  const { data } = await mavrykApi.post<AuthVerifyResponse>('/auth/verify', {
    walletAddress: address,
    nonce,
    signature: payload.signature,
    deviceInfo: payload.deviceInfo
  });

  const parsed = AuthVerifyResponseSchema.parse(data);
  await setAuthTokensToStorage({ accessToken: parsed.accessToken, refreshToken: parsed.refreshToken });

  return parsed;
}

export async function refreshAuthTokens(params: AuthRefreshRequest = {}) {
  const { accessToken: storedAccessToken, refreshToken: storedRefreshToken } = await getAuthTokensFromStorage();

  if (storedAccessToken && !isJwtExpiringSoon(storedAccessToken, ACCESS_TOKEN_REFRESH_THRESHOLD_MS)) {
    return { accessToken: storedAccessToken };
  }

  const refreshToken = params.refreshToken ?? storedRefreshToken;
  if (!refreshToken) throw new Error('No refresh token in storage');

  const { data } = await mavrykApi.post<AuthRefreshResponse>('/auth/refresh', {
    refreshToken
  });

  const parsed = AuthRefreshResponseSchema.parse(data);
  await setAuthTokensToStorage({ accessToken: parsed.accessToken });

  return parsed;
}

export async function logoutAuth(params: AuthRefreshRequest = {}) {
  const { refreshToken: storedRefreshToken } = await getAuthTokensFromStorage();
  const refreshToken = params.refreshToken ?? storedRefreshToken;

  await mavrykApi.post('/auth/logout', { refreshToken });
  await clearAuthTokensFromStorage();
}
