import browser from 'webextension-polyfill';

import {
  clearStoredAuthTokens,
  collectStoredRefreshTokens,
  getAuthTokensFromStorage,
  MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY,
  migrateAuthTokensToSessionStorage,
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

const createFakeStorageArea = () => {
  let store: Record<string, unknown> = {};
  const pick = (keys: string[]) => Object.fromEntries(keys.filter(key => key in store).map(key => [key, store[key]]));

  return {
    get: jest.fn(async (keys: string | string[] | null) =>
      keys === null ? { ...store } : pick(typeof keys === 'string' ? [keys] : keys)
    ),
    set: jest.fn(async (items: Record<string, unknown>) => {
      store = { ...store, ...items };
    }),
    remove: jest.fn(async (keys: string | string[]) => {
      (typeof keys === 'string' ? [keys] : keys).forEach(key => delete store[key]);
    }),
    clear: jest.fn(async () => {
      store = {};
    }),
    setAccessLevel: jest.fn(async () => undefined)
  };
};

describe('auth token session storage', () => {
  const storage = browser.storage as unknown as { session?: ReturnType<typeof createFakeStorageArea> };
  const context = { walletAddress: 'mv1-auth-wallet', networkId: 'mainnet' };
  let session: ReturnType<typeof createFakeStorageArea>;

  beforeEach(async () => {
    await browser.storage.local.clear();
    session = createFakeStorageArea();
    storage.session = session;
  });

  afterEach(() => {
    delete storage.session;
  });

  it('writes and reads tokens in session storage, never in local storage', async () => {
    await setAuthTokensToStorage({ accessToken: 'access', refreshToken: 'refresh' }, context);

    await expect(getAuthTokensFromStorage(context)).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh'
    });
    await expect(session.get(null)).resolves.toEqual({
      '[mv1-auth-wallet][mainnet]': 'access',
      '[mv1-auth-wallet][mainnet][refresh]': 'refresh'
    });
    await expect(browser.storage.local.get(null)).resolves.not.toHaveProperty('[mv1-auth-wallet][mainnet]');
    await expect(browser.storage.local.get(null)).resolves.not.toHaveProperty('[mv1-auth-wallet][mainnet][refresh]');
  });

  it('moves local tokens to session storage once and deletes the local copies', async () => {
    await browser.storage.local.set({
      '[mv1-auth-wallet][mainnet]': 'old-access',
      '[mv1-auth-wallet][mainnet][refresh]': 'old-refresh',
      '[mv1-auth-wallet][basenet][refresh]': 'basenet-refresh',
      [MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY]: 'legacy-refresh',
      unrelated: 'kept'
    });
    // Written after the local copy, so it must win
    await session.set({ '[mv1-auth-wallet][mainnet]': 'newer-access' });

    await migrateAuthTokensToSessionStorage();

    expect(session.setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
    await expect(browser.storage.local.get(null)).resolves.toEqual({ unrelated: 'kept' });
    await expect(session.get(null)).resolves.toEqual({
      '[mv1-auth-wallet][mainnet]': 'newer-access',
      '[mv1-auth-wallet][mainnet][refresh]': 'old-refresh',
      '[mv1-auth-wallet][basenet][refresh]': 'basenet-refresh',
      [MAVRYK_API_REFRESH_TOKEN_STORAGE_KEY]: 'legacy-refresh'
    });
    await expect(getAuthTokensFromStorage(context)).resolves.toEqual({
      accessToken: 'newer-access',
      refreshToken: 'old-refresh'
    });
  });

  it('collects and clears tokens across session and leftover local storage', async () => {
    await setAuthTokensToStorage({ accessToken: 'access', refreshToken: 'session-refresh' }, context);
    await browser.storage.local.set({ '[mv1-other-wallet][mainnet][refresh]': 'local-refresh', unrelated: 'kept' });

    await expect(collectStoredRefreshTokens()).resolves.toEqual(
      expect.arrayContaining([
        { ...context, refreshToken: 'session-refresh' },
        { walletAddress: 'mv1-other-wallet', networkId: 'mainnet', refreshToken: 'local-refresh' }
      ])
    );

    await clearStoredAuthTokens();

    await expect(session.get(null)).resolves.toEqual({});
    await expect(browser.storage.local.get(null)).resolves.toEqual({ unrelated: 'kept' });
  });
});
