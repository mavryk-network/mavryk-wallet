import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import browser from 'webextension-polyfill';

import { logoutAuth, refreshAuthTokens, requestAuthChallenge, verifyAuthSignature } from './auth';
import { buildStructuredAuthChallengeMessage } from './auth-payload.helpers';
import { mavrykApi, type MavrykApiRequestConfig } from './client';
import {
  getLastChallengeFromStorage,
  getLastChallengeExpiresAtFromStorage,
  getLastNonceFromStorage,
  getAuthTokensFromStorage,
  MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY,
  MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY,
  setAuthTokensToStorage
} from './storage';

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

  it('stores only validated structured auth challenges', async () => {
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const nonce = 'nonce-1234567890';
    const challenge = buildStructuredAuthChallengeMessage({
      walletAddress: authContext.walletAddress,
      networkId: authContext.networkId,
      nonce,
      expiresAt
    });
    const adapter = jest.fn(async (config: AxiosRequestConfig) =>
      createResponse(config, {
        challenge,
        expiresAt,
        nonce
      })
    );

    mavrykApi.defaults.adapter = adapter;

    await expect(requestAuthChallenge(authContext)).resolves.toEqual({
      challenge,
      expiresAt,
      nonce
    });
    await expect(getLastChallengeFromStorage()).resolves.toBe(challenge);
    await expect(getLastNonceFromStorage()).resolves.toBe(nonce);
    await expect(getLastChallengeExpiresAtFromStorage()).resolves.toBe(expiresAt);
  });

  it('rejects malformed auth challenges before storing them', async () => {
    const adapter = jest.fn(async (config: AxiosRequestConfig) =>
      createResponse(config, {
        challenge: 'challenge',
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        nonce: 'nonce-1234567890'
      })
    );

    mavrykApi.defaults.adapter = adapter;

    await expect(requestAuthChallenge(authContext)).rejects.toThrow(
      'Auth challenge does not match the expected structured message'
    );
    await expect(getLastChallengeFromStorage()).resolves.toBeUndefined();
    await expect(getLastNonceFromStorage()).resolves.toBeUndefined();
    await expect(getLastChallengeExpiresAtFromStorage()).resolves.toBeUndefined();
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

  it('rejects malformed refresh token responses without storing them', async () => {
    const oldAccessToken = buildJwt(Date.now() - 60_000);
    const oldRefreshToken = 'old-refresh-token';
    const adapter = jest.fn(async (config: AxiosRequestConfig) =>
      createResponse(config, {
        accessToken: 'not-a-jwt',
        refreshToken: 'next-refresh-token'
      })
    );

    mavrykApi.defaults.adapter = adapter;
    await setAuthTokensToStorage(
      {
        accessToken: oldAccessToken,
        refreshToken: oldRefreshToken
      },
      authContext
    );

    await expect(refreshAuthTokens(authContext)).rejects.toThrow();
    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({
      accessToken: oldAccessToken,
      refreshToken: oldRefreshToken
    });
  });

  it('rejects malformed verify token responses without storing them', async () => {
    const adapter = jest.fn(async (config: AxiosRequestConfig) =>
      createResponse(config, {
        accessToken: 'not-a-jwt',
        refreshToken: 'refresh-token'
      })
    );

    mavrykApi.defaults.adapter = adapter;

    await expect(
      verifyAuthSignature({
        walletAddress: authContext.walletAddress,
        networkId: authContext.networkId,
        nonce: 'nonce-1234567890',
        signature: 'signature'
      })
    ).rejects.toThrow();
    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({
      accessToken: null,
      refreshToken: null
    });
  });

  it('clears all local auth tokens before best-effort logout revocation', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      throw new Error(`logout failed for ${config.url}`);
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
    await setAuthTokensToStorage(
      {
        accessToken: buildJwt(Date.now() + 60_000),
        refreshToken: 'other-wallet-refresh-token'
      },
      { ...authContext, walletAddress: 'mv1-other-wallet' }
    );
    await browser.storage.local.set({
      [MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY]: 'legacy-access-token',
      [MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY]: 'legacy-refresh-token'
    });

    await expect(logoutAuth()).resolves.toBeUndefined();

    expect(adapter).toHaveBeenCalledTimes(4);
    expect(adapter.mock.calls.map(([config]) => parseAdapterData((config as MavrykApiRequestConfig).data))).toEqual(
      expect.arrayContaining([
        { refreshToken: 'mainnet-refresh-token' },
        { refreshToken: 'basenet-refresh-token' },
        { refreshToken: 'other-wallet-refresh-token' },
        { refreshToken: 'legacy-refresh-token' }
      ])
    );
    await expect(getAuthTokensFromStorage(authContext)).resolves.toEqual({
      accessToken: null,
      refreshToken: null
    });
    await expect(getAuthTokensFromStorage({ ...authContext, networkId: 'basenet' })).resolves.toEqual({
      accessToken: null,
      refreshToken: null
    });
    await expect(getAuthTokensFromStorage({ ...authContext, walletAddress: 'mv1-other-wallet' })).resolves.toEqual({
      accessToken: null,
      refreshToken: null
    });
    await expect(
      browser.storage.local.get([MAVRYK_API_ACCESS_TOKEN_STORAGE_KEY, MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY])
    ).resolves.toEqual({});

    consoleErrorSpy.mockRestore();
  });
});
