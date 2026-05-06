import { z } from 'zod';

import { getMavrykApiBaseUrl, MavrykApiRequestConfig, mavrykApi, MAVRYK_API_URLS } from './client';
import { isJwtExpiringSoon } from './jwt';
import {
  clearAuthTokensFromStorage,
  getAuthWalletAddressFromStorage,
  getAuthTokensFromStorage,
  getLastNonceFromStorage,
  getSelectedNetworkIdFromStorage,
  MavrykAuthStorageContext,
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
  networkId?: string;
  walletAddress?: string;
};

export type AuthVerifyRequest = {
  deviceInfo?: Record<string, unknown>;
  networkId?: string;
  nonce?: string;
  signature: string;
  walletAddress?: string;
};

export type AuthRefreshRequest = {
  networkId?: string;
  refreshToken?: string;
  walletAddress?: string;
};

const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 60_000;

async function getWalletAddressOrThrow(walletAddress?: string) {
  const stored = walletAddress ?? (await getAuthWalletAddressFromStorage());
  if (!stored) throw new Error('No wallet address in storage');
  return stored;
}

export async function requestAuthChallenge(params: AuthChallengeRequest = {}) {
  const address = await getWalletAddressOrThrow(params.walletAddress);
  const context = await getAuthContext({ walletAddress: address, networkId: params.networkId });
  const challengeRequestConfig: MavrykApiRequestConfig = {
    _authContext: context,
    skipAuthRefresh: true
  };

  const { data } = await mavrykApi.post<AuthChallengeResponse>(
    '/auth/challenge',
    {
      walletAddress: address
    },
    challengeRequestConfig
  );

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
  const context = await getAuthContext({ walletAddress: address, networkId: payload.networkId });
  const verifyRequestConfig: MavrykApiRequestConfig = {
    _authContext: context,
    skipAuthRefresh: true
  };

  const { data } = await mavrykApi.post<AuthVerifyResponse>(
    '/auth/verify',
    {
      walletAddress: address,
      nonce,
      signature: payload.signature,
      deviceInfo: payload.deviceInfo
    },
    verifyRequestConfig
  );

  const parsed = AuthVerifyResponseSchema.parse(data);
  await setAuthTokensToStorage({ accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }, context);

  return parsed;
}

export async function refreshAuthTokens(params: AuthRefreshRequest = {}) {
  const context = await getAuthContext(params);
  const { accessToken: storedAccessToken, refreshToken: storedRefreshToken } = await getAuthTokensFromStorage(context);

  if (storedAccessToken && !isJwtExpiringSoon(storedAccessToken, ACCESS_TOKEN_REFRESH_THRESHOLD_MS)) {
    return { accessToken: storedAccessToken };
  }

  const refreshToken = params.refreshToken ?? storedRefreshToken;
  if (!refreshToken) throw new Error('No refresh token in storage');

  const refreshRequestConfig: MavrykApiRequestConfig = {
    _authContext: context,
    skipAuthRefresh: true
  };
  const { data } = await mavrykApi.post<AuthRefreshResponse>('/auth/refresh', { refreshToken }, refreshRequestConfig);

  const parsed = AuthRefreshResponseSchema.parse(data);
  await setAuthTokensToStorage({ accessToken: parsed.accessToken }, context);

  return parsed;
}

export async function logoutAuth(params: AuthRefreshRequest = {}) {
  const context = await getAuthContext(params);
  const networkIds = params.networkId ? [params.networkId] : Object.keys(MAVRYK_API_URLS);

  await Promise.all(
    networkIds.map(async networkId => {
      const refreshToken =
        networkId === params.networkId && params.refreshToken
          ? params.refreshToken
          : (await getAuthTokensFromStorage({ ...context, networkId })).refreshToken;

      if (refreshToken) {
        const logoutRequestConfig: MavrykApiRequestConfig = {
          baseURL: getMavrykApiBaseUrl(networkId),
          _authContext: { ...context, networkId },
          skipAuthRefresh: true
        };

        await mavrykApi.post('/auth/logout', { refreshToken }, logoutRequestConfig);
      }

      await clearAuthTokensFromStorage({ ...context, networkId });
    })
  );
}

async function getAuthContext(params: AuthRefreshRequest): Promise<Required<MavrykAuthStorageContext>> {
  const [walletAddress, networkId] = await Promise.all([
    getWalletAddressOrThrow(params.walletAddress),
    params.networkId ? Promise.resolve(params.networkId) : getSelectedNetworkIdFromStorage()
  ]);

  return { walletAddress, networkId };
}
