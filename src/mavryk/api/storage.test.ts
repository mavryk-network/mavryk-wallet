import browser from 'webextension-polyfill';

import {
  clearStoredAuthTokens,
  collectStoredRefreshTokens,
  getAuthTokensFromStorage,
  setAuthTokensToStorage
} from './storage';

describe('auth token storage keys', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
  });

  it('stores tokens for a plain wallet and network scope', async () => {
    const context = { walletAddress: 'mv1-auth-wallet', networkId: 'mainnet' };

    await setAuthTokensToStorage({ accessToken: 'access', refreshToken: 'refresh' }, context);

    await expect(getAuthTokensFromStorage(context)).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh'
    });
    await expect(browser.storage.local.get(null)).resolves.toMatchObject({
      '[mv1-auth-wallet][mainnet]': 'access',
      '[mv1-auth-wallet][mainnet][refresh]': 'refresh'
    });
  });

  it('round-trips tokens for a custom network whose id is an IPv6 RPC URL', async () => {
    const context = { walletAddress: 'mv1-auth-wallet', networkId: 'https://[::1]:8732' };

    await setAuthTokensToStorage({ accessToken: 'access', refreshToken: 'refresh' }, context);

    await expect(getAuthTokensFromStorage(context)).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh'
    });
    await expect(collectStoredRefreshTokens(context)).resolves.toEqual([{ ...context, refreshToken: 'refresh' }]);

    await clearStoredAuthTokens(context);

    await expect(browser.storage.local.get(null)).resolves.toEqual({});
  });

  it.each([
    { walletAddress: 'mv1-auth-wallet', networkId: 'mainnet][refresh' },
    { walletAddress: 'mv1-auth-wallet', networkId: 'foo]bar' },
    { walletAddress: 'mv1-auth-wallet', networkId: 'foo[bar' },
    { walletAddress: 'mv1-auth-wallet', networkId: 'foo%5Dbar' },
    { walletAddress: 'mv1]auth', networkId: 'mainnet' },
    { walletAddress: 'mv1[auth', networkId: 'mainnet' }
  ])('writes tokens under a parseable, clearable key for %p', async context => {
    await setAuthTokensToStorage({ accessToken: 'access', refreshToken: 'refresh' }, context);

    await expect(getAuthTokensFromStorage(context)).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh'
    });
    await expect(collectStoredRefreshTokens()).resolves.toEqual([{ ...context, refreshToken: 'refresh' }]);

    await clearStoredAuthTokens();

    await expect(browser.storage.local.get(null)).resolves.toEqual({});
  });

  it('does not let an aliased network id reach the refresh-token slot of another scope', async () => {
    const context = { walletAddress: 'mv1-auth-wallet', networkId: 'mainnet' };

    await setAuthTokensToStorage({ accessToken: 'access', refreshToken: 'refresh' }, context);

    await expect(
      getAuthTokensFromStorage({ walletAddress: 'mv1-auth-wallet', networkId: 'mainnet][refresh' })
    ).resolves.toEqual({ accessToken: null, refreshToken: null });

    await setAuthTokensToStorage(
      { accessToken: 'attacker' },
      { walletAddress: 'mv1-auth-wallet', networkId: 'mainnet][refresh' }
    );

    await expect(getAuthTokensFromStorage(context)).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh'
    });
  });
});
