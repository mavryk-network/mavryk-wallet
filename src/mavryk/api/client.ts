import axiosFetchAdapter from '@vespaiach/axios-fetch-adapter';
import axios from 'axios';

import { EnvVars } from 'lib/env';

import { getAuthTokensFromStorage } from './storage';

const baseUrl = new URL('/api/v1', EnvVars.MAVRYK_API_URL).href;

export const mavrykApi = axios.create({
  baseURL: baseUrl,
  adapter: axiosFetchAdapter
});

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
