import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import browser from 'webextension-polyfill';

import { ACCOUNT_PKH_STORAGE_KEY } from 'lib/constants';

import { mavrykApi, type MavrykApiRequestConfig } from './client';
import { fetchTokenHistory, fetchWalletHistory } from './history';
import { fetchWalletRwaAssets } from './rwas';
import {
  getAuthTokensFromStorage,
  MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY,
  setAuthTokensToStorage
} from './storage';
import { fetchWalletTokens } from './tokens';

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

  it('sends public reads without Authorization, on the requested network, and never refreshes or clears tokens', async () => {
    const accessToken = buildJwt(Date.now() + 60_000);
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      throw createAxiosError(config, 401, { message: 'Unauthorized' });
    });

    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage({ accessToken, refreshToken: 'refresh-token' }, authContext);

    await expect(
      mavrykApi.get('/watch-only/wallets/mv1-watched/history', {
        publicRead: { networkId: 'basenet' }
      } as MavrykApiRequestConfig)
    ).rejects.toBeTruthy();

    expect(adapter).toHaveBeenCalledTimes(1);
    const requestConfig = adapter.mock.calls[0][0];
    expect((requestConfig.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
    expect(requestConfig.baseURL).toBe('https://basenet.wallet.mavryk.network/api/v1');
    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({
      accessToken,
      refreshToken: 'refresh-token'
    });
  });
});

describe('wallet-scoped reads after an account switch', () => {
  const PREVIOUS = 'mv1-previous-account';
  const NEXT = 'mv1-next-account';
  const WATCH_ONLY = 'mv1-watch-only';
  const authorizationOf = (config: AxiosRequestConfig) =>
    (config.headers as Record<string, string> | undefined)?.Authorization;

  beforeEach(async () => {
    jest.clearAllMocks();
    await browser.storage.local.clear();
    // Storage still selects the previous account, as it does while the switch write is in flight.
    await browser.storage.local.set({
      [ACCOUNT_PKH_STORAGE_KEY]: PREVIOUS,
      [MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY]: {}
    });
    await setAuthTokensToStorage({ accessToken: 'previous-token' }, { walletAddress: PREVIOUS, networkId: 'mainnet' });
    await setAuthTokensToStorage({ accessToken: 'next-token' }, { walletAddress: NEXT, networkId: 'mainnet' });
  });

  it.each([
    ['history', () => fetchWalletHistory({ walletAddress: NEXT })],
    ['token history', () => fetchTokenHistory('KT1Token', { walletAddress: NEXT })],
    ['tokens', () => fetchWalletTokens({ walletAddress: NEXT })],
    ['RWA assets', () => fetchWalletRwaAssets({ walletAddress: NEXT })]
  ])('authenticates a %s read as the requested account, not the selected one', async (_name, read) => {
    const adapter = jest.fn(async (config: AxiosRequestConfig) =>
      createResponse(
        config,
        String(config.url).includes('history') ? { walletAddress: NEXT, operations: [], hasMore: false } : []
      )
    );
    mavrykApi.defaults.adapter = adapter;

    await read();

    expect(authorizationOf(adapter.mock.calls[0][0])).toBe('Bearer next-token');
  });

  it('uses the auth wallet linked to the requested account', async () => {
    await browser.storage.local.set({ [MAVRYK_API_AUTH_WALLET_BY_ACCOUNT_STORAGE_KEY]: { [WATCH_ONLY]: NEXT } });
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, []));
    mavrykApi.defaults.adapter = adapter;

    await fetchWalletRwaAssets({ walletAddress: WATCH_ONLY });

    expect(adapter.mock.calls[0][0].url).toBe(`/wallets/${WATCH_ONLY}/assets`);
    expect(authorizationOf(adapter.mock.calls[0][0])).toBe('Bearer next-token');
  });
});

describe('auth recovery while sign-in is in progress', () => {
  const authorizationOf = (config: AxiosRequestConfig) =>
    (config.headers as Record<string, string> | undefined)?.Authorization;

  beforeEach(async () => {
    jest.clearAllMocks();
    await browser.storage.local.clear();
  });

  it('retries a request sent without a token with the token stored since, without refreshing', async () => {
    const signedInToken = buildJwt(Date.now() + 10 * 60_000);
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      if (authorizationOf(config) === `Bearer ${signedInToken}`) return createResponse(config, { ok: true });
      // Sign-in completes while the token-less request is being rejected.
      await setAuthTokensToStorage({ accessToken: signedInToken, refreshToken: 'refresh-token' }, authContext);
      throw createAxiosError(config, 401, { error: 'Authorization header required' });
    });
    mavrykApi.defaults.adapter = adapter;

    await expect(
      mavrykApi.get('/wallets/data', { _authContext: authContext } as MavrykApiRequestConfig)
    ).resolves.toMatchObject({ data: { ok: true } });

    expect(adapter.mock.calls.filter(([config]) => config.url === '/auth/refresh')).toHaveLength(0);
  });

  it('keeps stored tokens when the refresh cannot be attempted', async () => {
    const accessToken = buildJwt(Date.now() - 60_000);
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      throw createAxiosError(config, 401, { error: 'expired' });
    });
    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage({ accessToken }, authContext);

    await expect(
      mavrykApi.get('/wallets/data', { _authContext: authContext } as MavrykApiRequestConfig)
    ).rejects.toThrow('No refresh token in storage');

    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({ accessToken, refreshToken: null });
  });

  it('clears stored tokens when the server rejects the refresh', async () => {
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      throw createAxiosError(config, 401, { error: 'invalid refresh token' });
    });
    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage(
      { accessToken: buildJwt(Date.now() - 60_000), refreshToken: 'refresh-token' },
      authContext
    );

    await expect(
      mavrykApi.get('/wallets/data', { _authContext: authContext } as MavrykApiRequestConfig)
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(adapter.mock.calls.filter(([config]) => config.url === '/auth/refresh')).toHaveLength(1);
    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({ accessToken: null, refreshToken: null });
  });
});
