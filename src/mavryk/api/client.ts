import axiosFetchAdapter from '@vespaiach/axios-fetch-adapter';
import axios, { AxiosRequestConfig } from 'axios';

import { EnvVars } from 'lib/env';

import { clearAuthTokensFromStorage, getAuthTokensFromStorage, setAuthTokensToStorage } from './storage';

const baseUrl = new URL('/api/v1', EnvVars.MAVRYK_API_URL).href;
const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/challenge', '/auth/verify', '/auth/refresh', '/auth/logout'] as const;

type MavrykApiRequestConfig = AxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

export const mavrykApi = axios.create({
  baseURL: baseUrl,
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
  const { accessToken } = await getAuthTokensFromStorage();

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
