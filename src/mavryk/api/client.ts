import axiosFetchAdapter from '@vespaiach/axios-fetch-adapter';
import axios, { AxiosRequestConfig } from 'axios';

import {
  clearAuthTokensFromStorage,
  getAuthTokensFromStorage,
  getCurrentAuthStorageContext,
  setAuthTokensToStorage,
  DEFAULT_NETWORK_ID,
  MavrykAuthStorageContext
} from './storage';

const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/challenge', '/auth/verify', '/auth/refresh', '/auth/logout'] as const;
const MAINNET_MAVRYK_API_URL = 'https://wallet.mavryk.network';
const ATLASNET_MAVRYK_API_URL = 'https://atlasnet.wallet.mavryk.network';

export const MAVRYK_API_URLS: Record<string, string> = {
  mainnet: MAINNET_MAVRYK_API_URL,
  atlasnet: ATLASNET_MAVRYK_API_URL
};

export type MavrykApiRequestConfig = AxiosRequestConfig & {
  _authContext?: Required<MavrykAuthStorageContext>;
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

export const getMavrykApiUrl = (networkId?: string | null) => {
  if (!networkId) {
    return MAINNET_MAVRYK_API_URL;
  }

  return MAVRYK_API_URLS[networkId] ?? MAINNET_MAVRYK_API_URL;
};

export const getMavrykApiBaseUrl = (networkId?: string | null) => new URL('/api/v1', getMavrykApiUrl(networkId)).href;

export const mavrykApi = axios.create({
  baseURL: getMavrykApiBaseUrl(DEFAULT_NETWORK_ID),
  adapter: axiosFetchAdapter
});

const refreshAccessTokenPromises = new Map<string, Promise<string>>();

const isAuthRefreshCandidate = (url?: string) =>
  !AUTH_ENDPOINTS_WITHOUT_REFRESH.some(endpoint => (url ?? '').includes(endpoint));

const isMavrykApiRequestConfig = (config: unknown): config is MavrykApiRequestConfig =>
  Boolean(config && typeof config === 'object');

async function refreshAccessTokenOrThrow(context: MavrykAuthStorageContext = {}) {
  const authContext = await getCurrentAuthStorageContext(context);
  const refreshKey = [authContext.walletAddress ?? '', authContext.networkId].join('::');
  const currentRefreshPromise = refreshAccessTokenPromises.get(refreshKey);

  if (!currentRefreshPromise) {
    const refreshPromise = (async () => {
      const { refreshToken } = await getAuthTokensFromStorage(authContext);
      if (!refreshToken) throw new Error('No refresh token in storage');

      const refreshRequestConfig: MavrykApiRequestConfig = {
        url: '/auth/refresh',
        method: 'POST',
        data: { refreshToken },
        _authContext: authContext,
        skipAuthRefresh: true
      };
      const { data } = await mavrykApi.request<{ accessToken?: string }>(refreshRequestConfig);

      if (!data.accessToken) throw new Error('Invalid auth refresh response');

      await setAuthTokensToStorage({ accessToken: data.accessToken }, authContext);

      return data.accessToken;
    })().finally(() => {
      refreshAccessTokenPromises.delete(refreshKey);
    });

    refreshAccessTokenPromises.set(refreshKey, refreshPromise);
    return refreshPromise;
  }

  return currentRefreshPromise;
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

  if (accessToken) {
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

    requestConfig._retry = true;

    try {
      const accessToken = await refreshAccessTokenOrThrow(requestConfig._authContext);

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
