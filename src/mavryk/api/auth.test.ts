import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import browser from 'webextension-polyfill';

import { refreshAuthTokens } from './auth';
import { mavrykApi, type MavrykApiRequestConfig } from './client';
import { getAuthTokensFromStorage, setAuthTokensToStorage } from './storage';

jest.mock('@vespaiach/axios-fetch-adapter', () => jest.fn());

const authContext = {
  walletAddress: 'mv1-auth-wallet',
  networkId: 'mainnet'
};

function encodeBase64Url(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildJwt(expiresAtMs: number) {
  return [
    encodeBase64Url(JSON.stringify({ alg: 'none' })),
    encodeBase64Url(JSON.stringify({ exp: Math.floor(expiresAtMs / 1000) })),
    'signature'
  ].join('.');
}

function createResponse(config: AxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    config,
    data,
    headers: {},
    status: 200,
    statusText: 'OK'
  };
}

function parseAdapterData(data: unknown) {
  return typeof data === 'string' ? JSON.parse(data) : data;
}

describe('auth refresh', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await browser.storage.local.clear();
  });

  it('stores the rotated access token and refresh token after refresh', async () => {
    const nextAccessToken = buildJwt(Date.now() + 60_000);
    const nextRefreshToken = 'next-refresh-token';
    const adapter = jest.fn(async (config: AxiosRequestConfig) =>
      createResponse(config, {
        accessToken: nextAccessToken,
        refreshToken: nextRefreshToken
      })
    );

    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage(
      {
        accessToken: buildJwt(Date.now() - 60_000),
        refreshToken: 'old-refresh-token'
      },
      authContext
    );

    await expect(refreshAuthTokens(authContext)).resolves.toEqual({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken
    });

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(parseAdapterData((adapter.mock.calls[0][0] as MavrykApiRequestConfig).data)).toEqual({
      refreshToken: 'old-refresh-token'
    });
    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken
    });
  });
});
