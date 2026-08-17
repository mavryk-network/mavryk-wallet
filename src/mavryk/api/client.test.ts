import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import browser from 'webextension-polyfill';

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

function createAxiosError(config: AxiosRequestConfig, status: number, data: unknown) {
  return {
    config,
    isAxiosError: true,
    response: {
      config,
      data,
      headers: {},
      status,
      statusText: 'Unauthorized'
    }
  };
}

describe('mavrykApi auth interceptor', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await browser.storage.local.clear();
  });

  it('serializes concurrent refresh retries and stores the rotated refresh token', async () => {
    const oldAccessToken = buildJwt(Date.now() - 60_000);
    const nextAccessToken = buildJwt(Date.now() + 60_000);
    const nextRefreshToken = 'next-refresh-token';
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        return createResponse(config, {
          accessToken: nextAccessToken,
          refreshToken: nextRefreshToken
        });
      }

      if ((config.headers as Record<string, string> | undefined)?.Authorization === `Bearer ${nextAccessToken}`) {
        return createResponse(config, { ok: true });
      }

      throw createAxiosError(config, 401, { message: 'Unauthorized' });
    });

    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage(
      {
        accessToken: oldAccessToken,
        refreshToken: 'old-refresh-token'
      },
      authContext
    );

    await expect(
      Promise.all([
        mavrykApi.get('/account/data', { _authContext: authContext } as MavrykApiRequestConfig),
        mavrykApi.get('/account/data', { _authContext: authContext } as MavrykApiRequestConfig)
      ])
    ).resolves.toHaveLength(2);

    expect(adapter.mock.calls.filter(([config]) => config.url === '/auth/refresh')).toHaveLength(1);
    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken
    });
  });

  it('clears wallet auth tokens without refreshing when access token is revoked', async () => {
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      throw createAxiosError(config, 401, { message: 'Token has been revoked' });
    });

    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage(
      {
        accessToken: buildJwt(Date.now() + 60_000),
        refreshToken: 'mainnet-refresh-token'
      },
      authContext
    );
    await setAuthTokensToStorage(
      {
        accessToken: buildJwt(Date.now() + 60_000),
        refreshToken: 'basenet-refresh-token'
      },
      { ...authContext, networkId: 'basenet' }
    );

    await expect(
      mavrykApi.get('/account/data', { _authContext: authContext } as MavrykApiRequestConfig)
    ).rejects.toMatchObject({
      response: {
        status: 401
      }
    });

    expect(adapter.mock.calls.filter(([config]) => config.url === '/auth/refresh')).toHaveLength(0);
    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({
      accessToken: null,
      refreshToken: null
    });
    await expect(getAuthTokensFromStorage({ ...authContext, networkId: 'basenet' })).resolves.toEqual({
      accessToken: null,
      refreshToken: null
    });
  });

  it('clears wallet auth tokens when refresh token reuse is detected', async () => {
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        throw createAxiosError(config, 401, { code: 'REFRESH_TOKEN_REUSE' });
      }

      throw createAxiosError(config, 401, { message: 'Unauthorized' });
    });

    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage(
      {
        accessToken: buildJwt(Date.now() - 60_000),
        refreshToken: 'old-refresh-token'
      },
      authContext
    );
    await setAuthTokensToStorage(
      {
        accessToken: buildJwt(Date.now() + 60_000),
        refreshToken: 'basenet-refresh-token'
      },
      { ...authContext, networkId: 'basenet' }
    );

    await expect(
      mavrykApi.get('/account/data', { _authContext: authContext } as MavrykApiRequestConfig)
    ).rejects.toMatchObject({
      response: {
        status: 401
      }
    });

    expect(adapter.mock.calls.filter(([config]) => config.url === '/auth/refresh')).toHaveLength(1);
    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({
      accessToken: null,
      refreshToken: null
    });
    await expect(getAuthTokensFromStorage({ ...authContext, networkId: 'basenet' })).resolves.toEqual({
      accessToken: null,
      refreshToken: null
    });
  });

  it('does not attach Authorization to exact auth endpoints', async () => {
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, { ok: true }));

    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage(
      {
        accessToken: buildJwt(Date.now() + 60_000),
        refreshToken: 'refresh-token'
      },
      authContext
    );

    await mavrykApi.post('/auth/challenge', { walletAddress: authContext.walletAddress }, {
      _authContext: authContext,
      skipAuthRefresh: true
    } as MavrykApiRequestConfig);
    await mavrykApi.post('/api/v1/auth/refresh?source=test', {}, {
      _authContext: authContext,
      skipAuthRefresh: true
    } as MavrykApiRequestConfig);

    expect((adapter.mock.calls[0][0].headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
    expect((adapter.mock.calls[1][0].headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
  });

  it('attaches Authorization to protected endpoints whose path contains an auth endpoint substring', async () => {
    const accessToken = buildJwt(Date.now() + 60_000);
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, { ok: true }));

    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage(
      {
        accessToken,
        refreshToken: 'refresh-token'
      },
      authContext
    );

    await mavrykApi.get('/account/data/auth/refresh/status', { _authContext: authContext } as MavrykApiRequestConfig);

    expect((adapter.mock.calls[0][0].headers as Record<string, string> | undefined)?.Authorization).toBe(
      `Bearer ${accessToken}`
    );
  });
});
