import axiosFetchAdapter from '@vespaiach/axios-fetch-adapter';
import axios, { type AxiosRequestConfig } from 'axios';

import { normalizeNetworkId } from 'lib/temple/network-storage';

import { AuthRefreshResponseSchema } from './auth.schema';
import { isTerminalMavrykAuthError } from './errors';
import { isJwtExpiringSoon } from './jwt';
import {
  clearAllAuthTokensFromStorage,
  clearAuthTokensFromStorage,
  getAuthTokensFromStorage,
  getCurrentAuthStorageContext,
  setAuthTokensToStorage,
  DEFAULT_NETWORK_ID,
  type MavrykAuthStorageContext,
  type ResolvedMavrykAuthStorageContext
} from './storage';

const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/challenge', '/auth/verify', '/auth/refresh', '/auth/logout'] as const;
const ACCESS_TOKEN_REFRESH_THRESHOLD_MS = 60_000;
const MAINNET_MAVRYK_API_URL = 'https://wallet.mavryk.network';
const BASENET_MAVRYK_API_URL = 'https://basenet.wallet.mavryk.network';

export const MAVRYK_API_URLS: Record<string, string> = {
  mainnet: MAINNET_MAVRYK_API_URL,
  basenet: BASENET_MAVRYK_API_URL
};

export type MavrykApiRequestConfig = AxiosRequestConfig & {
  _authContext?: ResolvedMavrykAuthStorageContext;
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

export const getMavrykApiUrl = (networkId?: string | null) => {
  const normalizedNetworkId = normalizeNetworkId(networkId);

  if (!normalizedNetworkId) {
    return MAINNET_MAVRYK_API_URL;
  }

  return MAVRYK_API_URLS[normalizedNetworkId] ?? MAINNET_MAVRYK_API_URL;
};

export const getMavrykApiBaseUrl = (networkId?: string | null) => new URL('/api/v1', getMavrykApiUrl(networkId)).href;

export const mavrykApi = axios.create({
  baseURL: getMavrykApiBaseUrl(DEFAULT_NETWORK_ID),
  adapter: axiosFetchAdapter
});

type FreshAuthTokens = {
  accessToken: string;
  refreshToken?: string | null;
};

type RefreshStoredAuthTokensOptions = {
  context?: MavrykAuthStorageContext;
  forceRefresh?: boolean;
  refreshToken?: string;
  staleAccessToken?: string | null;
};

type WebLockManager = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

const refreshAuthTokensPromises = new Map<string, Promise<FreshAuthTokens>>();

const isAuthRefreshCandidate = (url?: string) =>
  !AUTH_ENDPOINTS_WITHOUT_REFRESH.some(endpoint => (url ?? '').includes(endpoint));

const isMavrykApiRequestConfig = (config: unknown): config is MavrykApiRequestConfig =>
  Boolean(config && typeof config === 'object');

const getAuthRefreshKey = (context: ResolvedMavrykAuthStorageContext) =>
  [context.walletAddress ?? '', context.networkId].join('::');

const getWebLocks = () =>
  typeof navigator === 'undefined' ? undefined : (navigator as unknown as { locks?: WebLockManager }).locks;

const withAuthRefreshLock = <T>(refreshKey: string, task: () => Promise<T>) => {
  const locks = getWebLocks();

  return locks ? locks.request(`mavryk-api-auth-refresh:${refreshKey}`, task) : task();
};

function getFreshStoredAuthTokens(
  tokens: Awaited<ReturnType<typeof getAuthTokensFromStorage>>,
  options: RefreshStoredAuthTokensOptions
): FreshAuthTokens | null {
  if (!tokens.accessToken || isJwtExpiringSoon(tokens.accessToken, ACCESS_TOKEN_REFRESH_THRESHOLD_MS)) {
    return null;
  }

  if (options.forceRefresh && (!options.staleAccessToken || tokens.accessToken === options.staleAccessToken)) {
    return null;
  }

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  };
}

async function refreshStoredAuthTokensOnce(
  authContext: ResolvedMavrykAuthStorageContext,
  options: RefreshStoredAuthTokensOptions
) {
  const storedTokens = await getAuthTokensFromStorage(authContext);
  const freshStoredTokens = getFreshStoredAuthTokens(storedTokens, options);

  if (freshStoredTokens) {
    return freshStoredTokens;
  }

  const refreshToken = options.refreshToken ?? storedTokens.refreshToken;
  if (!refreshToken) throw new Error('No refresh token in storage');

  const refreshRequestConfig: MavrykApiRequestConfig = {
    url: '/auth/refresh',
    method: 'POST',
    data: { refreshToken },
    _authContext: authContext,
    skipAuthRefresh: true
  };

  try {
    const { data } = await mavrykApi.request(refreshRequestConfig);
    const parsed = AuthRefreshResponseSchema.parse(data);

    await setAuthTokensToStorage(parsed, authContext);

    return parsed;
  } catch (error) {
    if (isTerminalMavrykAuthError(error)) {
      await clearAllAuthTokensFromStorage(authContext);
    }

    throw error;
  }
}

export async function refreshStoredAuthTokensOrThrow(options: RefreshStoredAuthTokensOptions = {}) {
  const authContext = await getCurrentAuthStorageContext(options.context);
  if (!authContext.walletAddress) throw new Error('No auth wallet address in storage');

  const storedTokens = await getAuthTokensFromStorage(authContext);
  const freshStoredTokens = getFreshStoredAuthTokens(storedTokens, options);

  if (freshStoredTokens) {
    return freshStoredTokens;
  }

  const refreshKey = getAuthRefreshKey(authContext);
  const currentRefreshPromise = refreshAuthTokensPromises.get(refreshKey);

  if (currentRefreshPromise) {
    return currentRefreshPromise;
  }

  const refreshPromise = withAuthRefreshLock(refreshKey, () =>
    refreshStoredAuthTokensOnce(authContext, options)
  ).finally(() => {
    refreshAuthTokensPromises.delete(refreshKey);
  });

  refreshAuthTokensPromises.set(refreshKey, refreshPromise);

  return refreshPromise;
}

function getAuthorizationAccessToken(headers: AxiosRequestConfig['headers']) {
  if (!headers || typeof headers !== 'object') {
    return null;
  }

  const record = headers as Record<string, unknown>;
  const authorization = record.Authorization ?? record.authorization;

  return typeof authorization === 'string' && authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;
}

mavrykApi.interceptors.request.use(async rawConfig => {
  const config: MavrykApiRequestConfig = rawConfig;
  const authContext = config._authContext ?? (await getCurrentAuthStorageContext());
  const { accessToken } = await getAuthTokensFromStorage(authContext);
  const instanceBaseUrl = mavrykApi.defaults.baseURL;
  const networkBaseUrl = getMavrykApiBaseUrl(authContext.networkId);

  if (!config.baseURL || config.baseURL === instanceBaseUrl) {
    config.baseURL = networkBaseUrl;
  }
  config._authContext = authContext;

  if (accessToken && isAuthRefreshCandidate(config.url)) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`
    };
  }

  return rawConfig;
});

mavrykApi.interceptors.response.use(
  response => response,
  async error => {
    const status = error.response?.status;
    const requestConfig = isMavrykApiRequestConfig(error.config) ? error.config : undefined;

    if (
      status !== 401 ||
      !requestConfig ||
      requestConfig._retry ||
      requestConfig.skipAuthRefresh ||
      !isAuthRefreshCandidate(requestConfig.url)
    ) {
      return Promise.reject(error);
    }

    if (isTerminalMavrykAuthError(error)) {
      await clearAllAuthTokensFromStorage(requestConfig._authContext);

      return Promise.reject(error);
    }

    requestConfig._retry = true;

    try {
      const { accessToken } = await refreshStoredAuthTokensOrThrow({
        context: requestConfig._authContext,
        forceRefresh: true,
        staleAccessToken: getAuthorizationAccessToken(requestConfig.headers)
      });

      requestConfig.headers = {
        ...requestConfig.headers,
        Authorization: `Bearer ${accessToken}`
      };

      return mavrykApi.request(requestConfig);
    } catch (refreshError) {
      await clearAuthTokensFromStorage(requestConfig._authContext);

      return Promise.reject(refreshError);
    }
  }
);
