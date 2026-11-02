import { MavrykWalletDAppErrorType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import browser from 'webextension-polyfill';

import { UNLOCK_INTERRUPTED_BY_LOCK_ERROR } from 'lib/constants';
import { WALLET_AUTOLOCK_TIME } from 'lib/fixed-times';
import {
  getAuthTokensFromStorage,
  isJwtExpiringSoon,
  logoutAuth,
  refreshAuthTokens,
  requestAuthChallenge
} from 'mavryk/api';

import { TempleAccount, TempleAccountType, TempleStatus } from '../types';

import { enforceAutolock, enforceAutolockOnPageOpen, lock, processDApp, unlock, unlockFromSession } from './actions';
import * as PagePresence from './page-presence';
import { inited, locked, store, unlocked } from './store';
import { Vault } from './vault';

jest.mock(
  'mavryk/api',
  () => ({
    getAuthTokensFromStorage: jest.fn(),
    getSelectedNetworkIdFromStorage: jest.fn(),
    isJwtExpiringSoon: jest.fn(),
    logoutAuth: jest.fn(),
    refreshAuthTokens: jest.fn(),
    requestAuthChallenge: jest.fn(),
    verifyAuthSignature: jest.fn()
  }),
  { virtual: true }
);

jest.mock('mavryk/api/storage', () => ({ setAuthWalletAddressesMapToStorage: jest.fn() }), { virtual: true });

jest.mock('mavryk/api/utils', () => ({ signAuthChallengeWithVault: jest.fn() }), { virtual: true });

jest.mock('lib/env', () => ({ ...jest.requireActual('lib/env'), BACKGROUND_IS_WORKER: false }));

jest.mock('./vault', () => ({
  Vault: {
    setup: jest.fn(),
    recoverFromSession: jest.fn(),
    forgetSession: jest.fn()
  }
}));

const mockedEnv: { BACKGROUND_IS_WORKER: boolean } = jest.requireMock('lib/env');
const mockedVault = Vault as jest.Mocked<typeof Vault>;
const mockedGetAuthTokensFromStorage = getAuthTokensFromStorage as jest.MockedFunction<typeof getAuthTokensFromStorage>;
const mockedIsJwtExpiringSoon = isJwtExpiringSoon as jest.MockedFunction<typeof isJwtExpiringSoon>;
const mockedRefreshAuthTokens = refreshAuthTokens as jest.MockedFunction<typeof refreshAuthTokens>;
const mockedRequestAuthChallenge = requestAuthChallenge as jest.MockedFunction<typeof requestAuthChallenge>;
const mockedLogoutAuth = logoutAuth as jest.MockedFunction<typeof logoutAuth>;

const testAccount: TempleAccount = {
  id: 'account-1',
  type: TempleAccountType.HD,
  name: 'Account 1',
  publicKeyHash: 'mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G',
  hdIndex: 0,
  walletId: 'wallet-1',
  isKYC: undefined
};

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('actions lock serialization', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    locked();
    await browser.storage.local.clear();
    inited(true);
    mockedGetAuthTokensFromStorage.mockResolvedValue({ accessToken: 'access-token' } as any);
    mockedIsJwtExpiringSoon.mockReturnValue(false);
  });

  it('keeps the wallet locked when a lock is acknowledged mid-way through session recovery', async () => {
    const recoverDeferred = createDeferred<any>();
    const settingsDeferred = createDeferred<{}>();
    const logoutDeferred = createDeferred<void>();
    const fetchSettings = jest.fn(() => settingsDeferred.promise);

    mockedVault.recoverFromSession.mockReturnValue(recoverDeferred.promise);
    mockedLogoutAuth.mockReturnValue(logoutDeferred.promise as any);

    const recovery = unlockFromSession();
    await flushPromises();

    recoverDeferred.resolve({ vault: { fetchSettings }, accounts: [testAccount] });
    await flushPromises();
    expect(mockedGetAuthTokensFromStorage).toHaveBeenCalled();
    expect(fetchSettings).toHaveBeenCalledTimes(1);

    const lockPromise = lock();
    logoutDeferred.resolve();
    await lockPromise;
    expect(store.getState().status).toBe(TempleStatus.Locked);

    settingsDeferred.resolve({});
    await recovery;

    expect(store.getState().status).toBe(TempleStatus.Locked);
    expect(store.getState().vault).toBeNull();
  });

  it('waits for a lock in flight before session recovery reads the session', async () => {
    const logoutDeferred = createDeferred<void>();

    // The lock forgets the session, so a recovery that runs after it finds none
    mockedVault.recoverFromSession.mockResolvedValue(null);
    mockedLogoutAuth.mockReturnValue(logoutDeferred.promise as any);

    const lockPromise = lock();
    const recovery = unlockFromSession();
    await flushPromises();
    expect(mockedVault.recoverFromSession).not.toHaveBeenCalled();

    logoutDeferred.resolve();
    await lockPromise;
    await recovery;

    expect(mockedVault.recoverFromSession).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe(TempleStatus.Locked);
    expect(store.getState().vault).toBeNull();
  });

  it('runs a password unlock started while a lock is in flight after that lock', async () => {
    const logoutDeferred = createDeferred<void>();
    const fetchAccounts = jest.fn().mockResolvedValue([testAccount]);
    const fetchSettings = jest.fn().mockResolvedValue({});

    unlocked({ vault: { fetchAccounts, fetchSettings } as any, accounts: [testAccount], settings: {} });
    mockedVault.setup.mockResolvedValue({ fetchAccounts, fetchSettings } as any);
    mockedLogoutAuth.mockReturnValue(logoutDeferred.promise as any);
    mockedRefreshAuthTokens.mockResolvedValue(undefined as any);

    const lockPromise = lock();
    const unlockPromise = unlock('password');
    await flushPromises();
    expect(mockedVault.setup).not.toHaveBeenCalled();

    logoutDeferred.resolve();
    await lockPromise;
    await expect(unlockPromise).resolves.toBeUndefined();

    expect(mockedVault.setup).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe(TempleStatus.Ready);
  });

  it('waits for every overlapping lock before a password unlock runs', async () => {
    const firstLogoutDeferred = createDeferred<void>();
    const secondLogoutDeferred = createDeferred<void>();
    const fetchAccounts = jest.fn().mockResolvedValue([testAccount]);
    const fetchSettings = jest.fn().mockResolvedValue({});

    mockedVault.setup.mockResolvedValue({ fetchAccounts, fetchSettings } as any);
    mockedLogoutAuth
      .mockReturnValueOnce(firstLogoutDeferred.promise as any)
      .mockReturnValueOnce(secondLogoutDeferred.promise as any);
    mockedRefreshAuthTokens.mockResolvedValue(undefined as any);

    const firstLock = lock();
    const secondLock = lock();
    const unlockPromise = unlock('password');

    secondLogoutDeferred.resolve();
    await secondLock;
    await flushPromises();
    expect(mockedVault.setup).not.toHaveBeenCalled();

    firstLogoutDeferred.resolve();
    await firstLock;
    await expect(unlockPromise).resolves.toBeUndefined();

    expect(store.getState().status).toBe(TempleStatus.Ready);
  });

  it('keeps the wallet locked and rejects the unlock when a lock lands while it is in flight', async () => {
    const setupDeferred = createDeferred<any>();
    const fetchAccounts = jest.fn().mockResolvedValue([testAccount]);
    const fetchSettings = jest.fn().mockResolvedValue({});

    mockedVault.setup.mockReturnValue(setupDeferred.promise);
    mockedLogoutAuth.mockResolvedValue(undefined as any);

    const unlockPromise = unlock('password');
    await flushPromises();

    await lock();

    setupDeferred.resolve({ fetchAccounts, fetchSettings });
    await expect(unlockPromise).rejects.toThrow(UNLOCK_INTERRUPTED_BY_LOCK_ERROR);

    expect(store.getState().status).toBe(TempleStatus.Locked);
    expect(store.getState().vault).toBeNull();
    expect(mockedRefreshAuthTokens).not.toHaveBeenCalled();
    expect(mockedRequestAuthChallenge).not.toHaveBeenCalled();
  });

  it('forgets the session pass hash that an aborted password unlock saved after the lock', async () => {
    mockedEnv.BACKGROUND_IS_WORKER = true;
    try {
      const setupDeferred = createDeferred<any>();
      const fetchAccounts = jest.fn().mockResolvedValue([testAccount]);
      const fetchSettings = jest.fn().mockResolvedValue({});

      mockedVault.setup.mockReturnValue(setupDeferred.promise);
      mockedLogoutAuth.mockResolvedValue(undefined as any);

      const unlockPromise = unlock('password');
      await flushPromises();

      await lock();
      expect(mockedVault.forgetSession).toHaveBeenCalledTimes(1);

      // Vault.setup saves the session pass hash, which here lands after lock() already forgot the session
      setupDeferred.resolve({ fetchAccounts, fetchSettings });
      await expect(unlockPromise).rejects.toThrow(UNLOCK_INTERRUPTED_BY_LOCK_ERROR);

      expect(mockedVault.setup).toHaveBeenCalledWith('password', true);
      expect(mockedVault.forgetSession).toHaveBeenCalledTimes(2);
      expect(store.getState().status).toBe(TempleStatus.Locked);
    } finally {
      mockedEnv.BACKGROUND_IS_WORKER = false;
    }
  });
});

describe('background autolock deadline', () => {
  const nexusOrigin = 'https://nexus.mavryk.org';
  const contactsGetRequest = {
    type: 'CONTACTS_GET_REQUEST',
    accountPublicKeyHash: testAccount.publicKeyHash
  };

  let fetchAccounts: jest.Mock;
  let hasOpenExtensionPagesSpy: jest.SpyInstance | undefined;

  beforeEach(async () => {
    jest.clearAllMocks();
    locked();
    await browser.storage.local.clear();
    inited(true);
    mockedLogoutAuth.mockResolvedValue(undefined as any);

    fetchAccounts = jest.fn().mockResolvedValue([testAccount]);
    unlocked({ vault: { fetchAccounts } as any, accounts: [testAccount], settings: {} });
  });

  afterEach(() => {
    hasOpenExtensionPagesSpy?.mockRestore();
    hasOpenExtensionPagesSpy = undefined;
    locked();
  });

  it('locks before serving a contacts request once the autolock deadline has passed', async () => {
    await browser.storage.local.set({
      lock_up_enabled: true,
      last_page_closure_timestamp: Date.now() - WALLET_AUTOLOCK_TIME - 1
    });

    await expect(processDApp(nexusOrigin, contactsGetRequest)).rejects.toThrow('Not ready');

    expect(store.getState().status).toBe(TempleStatus.Locked);
    expect(store.getState().vault).toBeNull();
    expect(fetchAccounts).not.toHaveBeenCalled();

    const { last_page_closure_timestamp: consumedTimestamp } = await browser.storage.local.get(
      'last_page_closure_timestamp'
    );
    expect(consumedTimestamp).toBeUndefined();

    unlocked({ vault: { fetchAccounts } as any, accounts: [testAccount], settings: {} });
    await expect(processDApp(nexusOrigin, contactsGetRequest)).rejects.toThrow(MavrykWalletDAppErrorType.NotGranted);
    expect(fetchAccounts).toHaveBeenCalledTimes(1);
  });

  it('treats an absent lock-up flag as enabled', async () => {
    await browser.storage.local.set({ last_page_closure_timestamp: Date.now() - WALLET_AUTOLOCK_TIME - 1 });

    await expect(processDApp(nexusOrigin, contactsGetRequest)).rejects.toThrow('Not ready');

    expect(store.getState().status).toBe(TempleStatus.Locked);
  });

  it.each([
    ['no page closure is recorded', { lock_up_enabled: true }],
    ['the last page closed recently', { lock_up_enabled: true, last_page_closure_timestamp: Date.now() - 1_000 }],
    [
      'lock-up is disabled',
      { lock_up_enabled: false, last_page_closure_timestamp: Date.now() - WALLET_AUTOLOCK_TIME - 1 }
    ]
  ])('serves the contacts request when %s', async (_, storedItems) => {
    await browser.storage.local.set(storedItems);

    await expect(processDApp(nexusOrigin, contactsGetRequest)).rejects.toThrow(MavrykWalletDAppErrorType.NotGranted);

    expect(store.getState().status).toBe(TempleStatus.Ready);
    expect(fetchAccounts).toHaveBeenCalledTimes(1);
    expect(mockedLogoutAuth).not.toHaveBeenCalled();
  });

  it('locks when the first page opens after the deadline, although a page is now open', async () => {
    hasOpenExtensionPagesSpy = jest.spyOn(PagePresence, 'hasOpenExtensionPages').mockReturnValue(true);
    await browser.storage.local.set({ last_page_closure_timestamp: Date.now() - WALLET_AUTOLOCK_TIME - 1 });

    await enforceAutolock();
    expect(store.getState().status).toBe(TempleStatus.Ready);

    await enforceAutolockOnPageOpen();
    expect(store.getState().status).toBe(TempleStatus.Locked);
    expect(store.getState().vault).toBeNull();
  });

  it('keeps the wallet unlocked when the first page opens before the deadline', async () => {
    hasOpenExtensionPagesSpy = jest.spyOn(PagePresence, 'hasOpenExtensionPages').mockReturnValue(true);
    await browser.storage.local.set({ last_page_closure_timestamp: Date.now() - 1_000 });

    await enforceAutolockOnPageOpen();

    expect(store.getState().status).toBe(TempleStatus.Ready);
    expect(mockedLogoutAuth).not.toHaveBeenCalled();
  });

  it('does not restore the session once the autolock deadline has passed', async () => {
    locked();
    const fetchSettings = jest.fn().mockResolvedValue({});
    mockedVault.recoverFromSession.mockResolvedValue({ vault: { fetchSettings }, accounts: [testAccount] } as any);
    mockedGetAuthTokensFromStorage.mockResolvedValue({ accessToken: 'access-token' } as any);
    mockedIsJwtExpiringSoon.mockReturnValue(false);
    await browser.storage.local.set({ last_page_closure_timestamp: Date.now() - WALLET_AUTOLOCK_TIME - 1 });

    await unlockFromSession();

    expect(store.getState().status).toBe(TempleStatus.Locked);
    expect(store.getState().vault).toBeNull();
    expect(mockedLogoutAuth).toHaveBeenCalledTimes(1);
  });
});
