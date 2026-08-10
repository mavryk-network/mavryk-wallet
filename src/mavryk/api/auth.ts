import { normalizeNetworkId } from 'lib/temple/network-storage';

import { validateAuthChallengeForSigning } from './auth-payload.helpers';
import {
  AuthChallengeResponseSchema,
  type AuthChallengeResponse,
  AuthVerifyResponseSchema,
  type AuthVerifyResponse
} from './auth.schema';
import { getMavrykApiBaseUrl, mavrykApi, type MavrykApiRequestConfig, refreshStoredAuthTokensOrThrow } from './client';
import {
  clearStoredAuthTokens,
  collectStoredRefreshTokens,
  getAuthWalletAddressFromStorage,
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

  const parsed = validateAuthChallengeForSigning(AuthChallengeResponseSchema.parse(data), {
    walletAddress: address,
    networkId: context.networkId
  });

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
  const hasExplicitScope = params.walletAddress !== undefined || params.networkId !== undefined;
  const context = hasExplicitScope ? await getAuthContext(params) : undefined;
  const storedRefreshTokens = await collectStoredRefreshTokens(context);
  const refreshTokens = params.refreshToken
    ? [
        ...storedRefreshTokens,
        {
          refreshToken: params.refreshToken,
          walletAddress: context?.walletAddress ?? null,
          networkId: context?.networkId ?? getSelectedNetworkIdOrDefault(params.networkId)
        }
      ]
    : storedRefreshTokens;

  await clearStoredAuthTokens(context);

  await Promise.all(
    refreshTokens.map(async ({ refreshToken, networkId, walletAddress }) => {
      const logoutRequestConfig: MavrykApiRequestConfig = {
        baseURL: getMavrykApiBaseUrl(networkId),
        _authContext: { walletAddress, networkId },
        skipAuthRefresh: true
      };

      try {
        await mavrykApi.post('/auth/logout', { refreshToken }, logoutRequestConfig);
      } catch (error) {
        console.error(error);
      }
    })
  );
}

async function getAuthContext(
  params: AuthRefreshRequest
): Promise<ResolvedMavrykAuthStorageContext & { walletAddress: string }> {
  const [walletAddress, networkId] = await Promise.all([
    getWalletAddressOrThrow(params.walletAddress),
    params.networkId
      ? Promise.resolve(getSelectedNetworkIdOrDefault(params.networkId))
      : getSelectedNetworkIdFromStorage()
  ]);

  return { walletAddress, networkId };
}

function getSelectedNetworkIdOrDefault(networkId?: string) {
  return normalizeNetworkId(networkId) ?? 'mainnet';
}
