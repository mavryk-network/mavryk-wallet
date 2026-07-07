import { normalizeNetworkId } from 'lib/temple/network-storage';

import {
  AuthChallengeResponseSchema,
  type AuthChallengeResponse,
  AuthVerifyResponseSchema,
  type AuthVerifyResponse
} from './auth.schema';
import {
  getMavrykApiBaseUrl,
  mavrykApi,
  MAVRYK_API_URLS,
  type MavrykApiRequestConfig,
  refreshStoredAuthTokensOrThrow
} from './client';
import {
  clearAuthTokensFromStorage,
  getAuthWalletAddressFromStorage,
  getAuthTokensFromStorage,
  getLastNonceFromStorage,
  getSelectedNetworkIdFromStorage,
  setAuthTokensToStorage,
  setLastChallengeToStorage,
  type ResolvedMavrykAuthStorageContext
} from './storage';

export type { AuthChallengeResponse, AuthRefreshResponse, AuthVerifyResponse } from './auth.schema';

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

  return refreshStoredAuthTokensOrThrow({ context, refreshToken: params.refreshToken });
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

async function getAuthContext(
  params: AuthRefreshRequest
): Promise<ResolvedMavrykAuthStorageContext & { walletAddress: string }> {
  const [walletAddress, networkId] = await Promise.all([
    getWalletAddressOrThrow(params.walletAddress),
    params.networkId ? Promise.resolve(normalizeNetworkId(params.networkId)) : getSelectedNetworkIdFromStorage()
  ]);

  return { walletAddress, networkId };
}
