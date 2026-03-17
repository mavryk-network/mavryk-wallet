import axiosFetchAdapter from '@vespaiach/axios-fetch-adapter';
import axios, { AxiosRequestConfig } from 'axios';
import browser from 'webextension-polyfill';

import { clearAuthTokensFromStorage, getAuthTokensFromStorage, setAuthTokensToStorage } from './storage';

const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/challenge', '/auth/verify', '/auth/refresh', '/auth/logout'] as const;
const NETWORK_ID_STORAGE_KEY = 'network_id';
const DEFAULT_NETWORK_ID = 'mainnet';
const MAINNET_MAVRYK_API_URL = 'https://wallet.mavryk.network';
const ATLASNET_MAVRYK_API_URL = 'https://atlasnet.wallet.mavryk.network';

const MAVRYK_API_URLS: Record<string, string> = {
  mainnet: MAINNET_MAVRYK_API_URL,
  atlasnet: ATLASNET_MAVRYK_API_URL
};

type MavrykApiRequestConfig = AxiosRequestConfig & {
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

async function getCurrentMavrykApiBaseUrl() {
  try {
    const { [NETWORK_ID_STORAGE_KEY]: networkId } = await browser.storage.local.get(NETWORK_ID_STORAGE_KEY);

    return getMavrykApiBaseUrl(networkId);
  } catch {
    return getMavrykApiBaseUrl(DEFAULT_NETWORK_ID);
  }
}

export const mavrykApi = axios.create({
  baseURL: getMavrykApiBaseUrl(DEFAULT_NETWORK_ID),
  adapter: axiosFetchAdapter
});

let refreshAccessTokenPromise: Promise<string> | null = null;

const isAuthRefreshCandidate = (url?: string) =>
  !AUTH_ENDPOINTS_WITHOUT_REFRESH.some(endpoint => (url ?? '').includes(endpoint));

const isMavrykApiRequestConfig = (config: unknown): config is MavrykApiRequestConfig =>
  Boolean(config && typeof config === 'object');

async function refreshAccessTokenOrThrow() {
  if (!refreshAccessTokenPromise) {
    refreshAccessTokenPromise = (async () => {
      const { refreshToken } = await getAuthTokensFromStorage();
      if (!refreshToken) throw new Error('No refresh token in storage');

      const { data } = await mavrykApi.request<{ accessToken?: string }>({
        url: '/auth/refresh',
        method: 'POST',
        data: { refreshToken },
        skipAuthRefresh: true
      });

      if (!data.accessToken) throw new Error('Invalid auth refresh response');

      await setAuthTokensToStorage({ accessToken: data.accessToken });

      return data.accessToken;
    })().finally(() => {
      refreshAccessTokenPromise = null;
    });
  }

  return refreshAccessTokenPromise;
}

mavrykApi.interceptors.request.use(async config => {
  const [baseURL, { accessToken }] = await Promise.all([getCurrentMavrykApiBaseUrl(), getAuthTokensFromStorage()]);

  config.baseURL = baseURL;

  if (accessToken) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`
    };
  }

  return config;
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
      const accessToken = await refreshAccessTokenOrThrow();

      requestConfig.headers = {
        ...requestConfig.headers,
        Authorization: `Bearer ${accessToken}`
      };

      return mavrykApi.request(requestConfig);
    } catch (refreshError) {
      await clearAuthTokensFromStorage();

      return Promise.reject(refreshError);
    }
  }
);
