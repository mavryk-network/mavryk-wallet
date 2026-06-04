import browser from 'webextension-polyfill';

import {
  getAuthTokensFromStorage,
  getSelectedNetworkIdFromStorage,
  refreshAuthTokens,
  requestAuthChallenge,
  verifyAuthSignature
} from 'mavryk/api';
import { setAuthWalletAddressesMapToStorage } from 'mavryk/api/storage';
import { signAuthChallengeWithVault } from 'mavryk/api/utils';

import { TempleAccount, TempleAccountType, TempleStatus } from '../types';

import { registerNewWallet, unlock } from './actions';
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

jest.mock(
  'mavryk/api/storage',
  () => ({
    setAuthWalletAddressesMapToStorage: jest.fn()
  }),
  { virtual: true }
);

jest.mock(
  'mavryk/api/utils',
  () => ({
    signAuthChallengeWithVault: jest.fn()
  }),
  { virtual: true }
);

jest.mock('./vault', () => ({
  Vault: {
    spawn: jest.fn(),
    setup: jest.fn(),
    recoverFromSession: jest.fn(),
    forgetSession: jest.fn(),
    isExist: jest.fn()
  }
}));

const mockedVault = Vault as jest.Mocked<typeof Vault>;
const mockedGetAuthTokensFromStorage = getAuthTokensFromStorage as jest.MockedFunction<typeof getAuthTokensFromStorage>;
const mockedGetSelectedNetworkIdFromStorage = getSelectedNetworkIdFromStorage as jest.MockedFunction<
  typeof getSelectedNetworkIdFromStorage
>;
const mockedRefreshAuthTokens = refreshAuthTokens as jest.MockedFunction<typeof refreshAuthTokens>;
const mockedRequestAuthChallenge = requestAuthChallenge as jest.MockedFunction<typeof requestAuthChallenge>;
const mockedVerifyAuthSignature = verifyAuthSignature as jest.MockedFunction<typeof verifyAuthSignature>;
const mockedSetAuthWalletAddressesMapToStorage = setAuthWalletAddressesMapToStorage as jest.MockedFunction<
  typeof setAuthWalletAddressesMapToStorage
>;
const mockedSignAuthChallengeWithVault = signAuthChallengeWithVault as jest.MockedFunction<
  typeof signAuthChallengeWithVault
>;

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

describe('actions auth sequencing', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    locked();
    await browser.storage.local.clear();
  });

  it('waits for initial auth before emitting unlocked when registering a wallet', async () => {
    inited(false);

    const verifyDeferred = createDeferred<{ accessToken: string; refreshToken: string }>();
    const fetchAccounts = jest.fn().mockResolvedValue([testAccount]);
    const fetchSettings = jest.fn().mockResolvedValue({});

    mockedVault.spawn.mockResolvedValue(testAccount.publicKeyHash);
    mockedVault.setup.mockResolvedValue({ fetchAccounts, fetchSettings } as any);
    mockedRequestAuthChallenge.mockResolvedValue({ nonce: 'nonce', challenge: 'challenge', expiresAt: '2030-01-01' });
    mockedSignAuthChallengeWithVault.mockResolvedValue('signature');
    mockedVerifyAuthSignature.mockReturnValue(verifyDeferred.promise);

    const unlockedPayloads: unknown[] = [];
    const unsubscribe = unlocked.watch(payload => unlockedPayloads.push(payload));

    const registerPromise = registerNewWallet('password', 'seed phrase');
    await flushPromises();

    expect(mockedVault.spawn).toHaveBeenCalledTimes(1);
    expect(mockedVault.setup).toHaveBeenCalledTimes(1);
    expect(mockedRequestAuthChallenge).toHaveBeenCalledTimes(1);
    expect(mockedVerifyAuthSignature).toHaveBeenCalledTimes(1);
    expect(mockedRefreshAuthTokens).not.toHaveBeenCalled();
    expect(unlockedPayloads).toHaveLength(0);
    expect(store.getState().status).toBe(TempleStatus.Idle);

    verifyDeferred.resolve({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    await expect(registerPromise).resolves.toBe(testAccount.publicKeyHash);

    expect(unlockedPayloads).toHaveLength(1);
    expect(store.getState().status).toBe(TempleStatus.Ready);
    expect(mockedSetAuthWalletAddressesMapToStorage).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('keeps unlock best-effort when background auth fails', async () => {
    inited(true);

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchAccounts = jest.fn().mockResolvedValue([testAccount]);
    const fetchSettings = jest.fn().mockResolvedValue({});

    mockedVault.setup.mockResolvedValue({ fetchAccounts, fetchSettings } as any);
    mockedGetSelectedNetworkIdFromStorage.mockResolvedValue('mainnet');
    mockedGetAuthTokensFromStorage.mockResolvedValue({ accessToken: null, refreshToken: null });
    mockedRefreshAuthTokens.mockRejectedValue(new Error('refresh failed'));
    mockedRequestAuthChallenge.mockRejectedValue(new Error('challenge failed'));

    await expect(unlock('password')).resolves.toBeUndefined();

    expect(store.getState().status).toBe(TempleStatus.Ready);
    expect(mockedRefreshAuthTokens).toHaveBeenCalledTimes(1);
    expect(mockedRequestAuthChallenge).toHaveBeenCalledTimes(1);
    expect(mockedVerifyAuthSignature).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
