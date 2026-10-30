import browser from 'webextension-polyfill';

import * as Beacon from 'lib/temple/beacon';
import {
  getAuthTokensFromStorage,
  getSelectedNetworkIdFromStorage,
  isJwtExpiringSoon,
  logoutAuth,
  refreshAuthTokens,
  requestAuthChallenge,
  verifyAuthSignature
} from 'mavryk/api';
import { setAuthWalletAddressesMapToStorage } from 'mavryk/api/storage';
import { signAuthChallengeWithVault } from 'mavryk/api/utils';

import { TempleAccount, TempleAccountType, TempleChainKind, TempleStatus } from '../types';

import {
  registerNewWallet,
  removeAccount,
  removeAccountsByType,
  removeHdWallet,
  unlock,
  unlockFromSession
} from './actions';
import { getAllDApps } from './dapp';
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

jest.mock('lib/temple/beacon', () => ({
  ...jest.requireActual('lib/temple/beacon'),
  removeDAppPublicKey: jest.fn()
}));

jest.mock('./vault', () => ({
  Vault: {
    spawn: jest.fn(),
    setup: jest.fn(),
    recoverFromSession: jest.fn(),
    forgetSession: jest.fn(),
    isExist: jest.fn(),
    removeAccount: jest.fn(),
    removeHdWallet: jest.fn(),
    removeAccountsByType: jest.fn()
  }
}));

const mockedVault = Vault as jest.Mocked<typeof Vault>;
const mockedGetAuthTokensFromStorage = getAuthTokensFromStorage as jest.MockedFunction<typeof getAuthTokensFromStorage>;
const mockedGetSelectedNetworkIdFromStorage = getSelectedNetworkIdFromStorage as jest.MockedFunction<
  typeof getSelectedNetworkIdFromStorage
>;
const mockedIsJwtExpiringSoon = isJwtExpiringSoon as jest.MockedFunction<typeof isJwtExpiringSoon>;
const mockedRefreshAuthTokens = refreshAuthTokens as jest.MockedFunction<typeof refreshAuthTokens>;
const mockedRequestAuthChallenge = requestAuthChallenge as jest.MockedFunction<typeof requestAuthChallenge>;
const mockedVerifyAuthSignature = verifyAuthSignature as jest.MockedFunction<typeof verifyAuthSignature>;
const mockedSetAuthWalletAddressesMapToStorage = setAuthWalletAddressesMapToStorage as jest.MockedFunction<
  typeof setAuthWalletAddressesMapToStorage
>;
const mockedSignAuthChallengeWithVault = signAuthChallengeWithVault as jest.MockedFunction<
  typeof signAuthChallengeWithVault
>;
const mockedLogoutAuth = logoutAuth as jest.MockedFunction<typeof logoutAuth>;
const mockedRemoveDAppPublicKey = Beacon.removeDAppPublicKey as jest.MockedFunction<typeof Beacon.removeDAppPublicKey>;

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

  it('unlocks from the session with the accounts decrypted during recovery', async () => {
    inited(true);

    const fetchAccounts = jest.fn();
    const fetchSettings = jest.fn().mockResolvedValue({});
    const vault = { fetchAccounts, fetchSettings };

    mockedVault.recoverFromSession.mockResolvedValue({ vault, accounts: [testAccount] } as any);
    mockedGetAuthTokensFromStorage.mockResolvedValue({ accessToken: 'access-token' } as any);
    mockedIsJwtExpiringSoon.mockReturnValue(false);

    await unlockFromSession();

    expect(fetchAccounts).not.toHaveBeenCalled();
    expect(fetchSettings).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe(TempleStatus.Ready);
    expect(store.getState().accounts).toEqual([testAccount]);
  });
});

describe('actions account removal clean-up', () => {
  const removedAccount: TempleAccount = {
    id: 'account-2',
    type: TempleAccountType.Imported,
    name: 'Account 2',
    publicKeyHash: 'mv1HmdN1hRxhJW1aeLpGJdvAuBY48z38JjVq',
    chain: TempleChainKind.Tezos,
    isKYC: undefined
  };
  const removedOrigin = 'https://removed.example';
  const keptOrigin = 'https://kept.example';
  const buildSession = (pkh: string) => ({
    network: 'mainnet',
    appMeta: { name: 'dApp' },
    pkh,
    publicKey: 'edpk-public-key'
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    locked();
    await browser.storage.local.clear();
    inited(true);

    const fetchAccounts = jest.fn().mockResolvedValue([testAccount, removedAccount]);
    unlocked({ vault: { fetchAccounts } as any, accounts: [testAccount, removedAccount], settings: {} });

    await browser.storage.local.set({
      dapp_sessions: {
        [removedOrigin]: buildSession(removedAccount.publicKeyHash),
        [keptOrigin]: buildSession(testAccount.publicKeyHash)
      }
    });
  });

  it('revokes wallet-API auth before removing accounts by type', async () => {
    mockedVault.removeAccountsByType.mockResolvedValue([testAccount]);

    await removeAccountsByType(TempleAccountType.Imported, 'password');

    expect(mockedLogoutAuth).toHaveBeenCalledTimes(1);
    expect(mockedVault.removeAccountsByType).toHaveBeenCalledWith(TempleAccountType.Imported, 'password');
  });

  it('drops the dApp sessions of a removed account and keeps the others', async () => {
    mockedVault.removeAccount.mockResolvedValue({ newAccounts: [testAccount], newWalletsSpecs: {} });

    await removeAccount(removedAccount.id, 'password');

    expect(Object.keys(await getAllDApps())).toEqual([keptOrigin]);
    expect(mockedRemoveDAppPublicKey).toHaveBeenCalledTimes(1);
    expect(mockedRemoveDAppPublicKey).toHaveBeenCalledWith(removedOrigin);
  });

  it('drops the dApp sessions of accounts removed with their HD wallet', async () => {
    mockedVault.removeHdWallet.mockResolvedValue({ newAccounts: [removedAccount], newWalletsSpecs: {} });

    await removeHdWallet('wallet-1', 'password');

    expect(Object.keys(await getAllDApps())).toEqual([removedOrigin]);
    expect(mockedRemoveDAppPublicKey).toHaveBeenCalledWith(keptOrigin);
  });

  it('drops the dApp sessions of accounts removed by type', async () => {
    mockedVault.removeAccountsByType.mockResolvedValue([testAccount]);

    await removeAccountsByType(TempleAccountType.Imported, 'password');

    expect(Object.keys(await getAllDApps())).toEqual([keptOrigin]);
    expect(mockedRemoveDAppPublicKey).toHaveBeenCalledWith(removedOrigin);
  });

  it('sweeps dApp sessions orphaned by earlier removals on unlock', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchAccounts = jest.fn().mockResolvedValue([testAccount]);
    const fetchSettings = jest.fn().mockResolvedValue({});
    locked();
    mockedVault.setup.mockResolvedValue({ fetchAccounts, fetchSettings } as any);
    mockedGetSelectedNetworkIdFromStorage.mockResolvedValue('mainnet');
    mockedGetAuthTokensFromStorage.mockResolvedValue({ accessToken: null, refreshToken: null });

    await unlock('password');

    expect(Object.keys(await getAllDApps())).toEqual([keptOrigin]);
    expect(mockedRemoveDAppPublicKey).toHaveBeenCalledTimes(1);
    expect(mockedRemoveDAppPublicKey).toHaveBeenCalledWith(removedOrigin);

    consoleErrorSpy.mockRestore();
  });

  it('sweeps dApp sessions orphaned by earlier removals on session recovery', async () => {
    const fetchSettings = jest.fn().mockResolvedValue({});
    locked();
    mockedVault.recoverFromSession.mockResolvedValue({ vault: { fetchSettings }, accounts: [testAccount] } as any);
    mockedGetAuthTokensFromStorage.mockResolvedValue({ accessToken: 'access-token' } as any);
    mockedIsJwtExpiringSoon.mockReturnValue(false);

    await unlockFromSession();

    expect(Object.keys(await getAllDApps())).toEqual([keptOrigin]);
    expect(mockedRemoveDAppPublicKey).toHaveBeenCalledWith(removedOrigin);
  });
});
