import browser, { Runtime } from 'webextension-polyfill';

import { IntercomPortKind } from 'lib/intercom';
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

import { TempleAccount, TempleAccountType, TempleChainKind, TempleMessageType, TempleStatus } from '../types';

import {
  registerNewWallet,
  removeAccount,
  removeAccountsByType,
  removeHdWallet,
  sendOperations,
  sign,
  unlock,
  unlockFromSession
} from './actions';
import { IN_WALLET_CONFIRMATION_AUTODECLINE_MS } from './constants';
import { getAllDApps } from './dapp';
import { intercom } from './defaults';
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

jest.mock('lib/temple/helpers', () => ({
  ...jest.requireActual('lib/temple/helpers'),
  loadChainId: jest.fn(() => Promise.reject(new Error('offline')))
}));

jest.mock('./dryrun', () => ({
  ...jest.requireActual('./dryrun'),
  dryRunOpParams: jest.fn(() => Promise.resolve(null))
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

describe('in-wallet confirmation decision finalisation', () => {
  const uiPort = {} as Runtime.Port;
  const confirmationId = 'confirmation-1';
  const networkRpc = 'https://rpc.example';
  const decisionReq = { type: TempleMessageType.ConfirmationRequest, id: confirmationId, confirmed: true };

  type Handler = (req: any, port: Runtime.Port, portInfo: any) => Promise<any>;

  let handlers: Handler[];
  let disconnectListeners: Array<() => void>;
  let spies: jest.SpyInstance[];

  const flushMicrotasks = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
  };

  const deliver = (req: any) => Promise.all(handlers.map(handler => handler(req, uiPort, {})));

  const settleOutcome = (promise: Promise<unknown>) => {
    const outcome = jest.fn();
    promise.then(
      res => outcome('resolved', res),
      err => outcome('rejected', err.message)
    );

    return outcome;
  };

  const unlockWithVault = (vault: Record<string, jest.Mock>) => {
    unlocked({ vault: vault as any, accounts: [testAccount], settings: {} });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    locked();
    inited(true);

    handlers = [];
    disconnectListeners = [];
    spies = [
      jest.spyOn(intercom, 'getPortInfo').mockReturnValue({ kind: IntercomPortKind.ExtensionUi }),
      jest.spyOn(intercom, 'notify').mockImplementation(() => undefined),
      jest.spyOn(intercom, 'onRequest').mockImplementation(handler => {
        handlers.push(handler);
        return () => {
          handlers = handlers.filter(h => h !== handler);
        };
      }),
      jest.spyOn(intercom, 'onDisconnect').mockImplementation((_port, listener) => {
        disconnectListeners.push(listener);
        return () => {
          disconnectListeners = disconnectListeners.filter(l => l !== listener);
        };
      })
    ];
  });

  afterEach(() => {
    spies.forEach(spy => spy.mockRestore());
    jest.useRealTimers();
    locked();
  });

  it('does not decline confirmed operations while the vault is still signing and broadcasting', async () => {
    const sendResult = createDeferred<{ hash: string; results: any[] }>();
    const vaultSendOperations = jest.fn(() => sendResult.promise);
    unlockWithVault({ revealPublicKey: jest.fn(() => Promise.resolve('edpk')), sendOperations: vaultSendOperations });

    const outcome = settleOutcome(
      sendOperations(uiPort, confirmationId, testAccount.publicKeyHash, networkRpc, [
        { kind: 'transaction', to: testAccount.publicKeyHash, amount: 1 }
      ])
    );
    await flushMicrotasks();

    const decision = deliver(decisionReq);
    await flushMicrotasks();

    jest.advanceTimersByTime(IN_WALLET_CONFIRMATION_AUTODECLINE_MS + 1);
    disconnectListeners.forEach(listener => listener());
    await flushMicrotasks();

    expect(outcome).not.toHaveBeenCalled();

    sendResult.resolve({ hash: 'opHash', results: [] });
    await decision;
    await flushMicrotasks();

    expect(outcome).toHaveBeenCalledTimes(1);
    expect(outcome).toHaveBeenCalledWith('resolved', { opHash: 'opHash' });
  });

  it('returns the applied fee of the whole group, reveal included', async () => {
    const vaultSendOperations = jest.fn(() =>
      Promise.resolve({
        hash: 'opHash',
        results: [
          { kind: 'reveal', fee: '331' },
          { kind: 'transaction', fee: '287' }
        ]
      })
    );
    unlockWithVault({ revealPublicKey: jest.fn(() => Promise.resolve('edpk')), sendOperations: vaultSendOperations });

    const outcome = settleOutcome(
      sendOperations(uiPort, confirmationId, testAccount.publicKeyHash, networkRpc, [
        { kind: 'transaction', to: testAccount.publicKeyHash, amount: 1 }
      ])
    );
    await flushMicrotasks();

    await deliver(decisionReq);
    await flushMicrotasks();

    expect(outcome).toHaveBeenCalledWith('resolved', { opHash: 'opHash', feeMumav: '618' });
  });

  it('rejects a repeated operations decision for the same id while the first is in flight', async () => {
    const sendResult = createDeferred<{ hash: string; results: any[] }>();
    const vaultSendOperations = jest.fn(() => sendResult.promise);
    unlockWithVault({ revealPublicKey: jest.fn(() => Promise.resolve('edpk')), sendOperations: vaultSendOperations });

    sendOperations(uiPort, confirmationId, testAccount.publicKeyHash, networkRpc, [
      { kind: 'transaction', to: testAccount.publicKeyHash, amount: 1 }
    ]);
    await flushMicrotasks();

    const decision = deliver(decisionReq);
    await flushMicrotasks();

    const repeatedDecision = deliver(decisionReq);
    repeatedDecision.catch(() => undefined);
    await flushMicrotasks();

    expect(vaultSendOperations).toHaveBeenCalledTimes(1);

    sendResult.resolve({ hash: 'opHash', results: [] });
    await decision;
    await expect(repeatedDecision).rejects.toThrow('Confirmation is already being processed');
  });

  it('does not decline a confirmed sign request or sign twice for the same id', async () => {
    const signResult = createDeferred<{ prefixSig: string }>();
    const vaultSign = jest.fn(() => signResult.promise);
    unlockWithVault({ sign: vaultSign });

    const outcome = settleOutcome(sign(uiPort, confirmationId, testAccount.publicKeyHash, '0501'));
    await flushMicrotasks();

    const decision = deliver(decisionReq);
    await flushMicrotasks();

    jest.advanceTimersByTime(IN_WALLET_CONFIRMATION_AUTODECLINE_MS + 1);
    disconnectListeners.forEach(listener => listener());
    const repeatedDecision = deliver(decisionReq);
    repeatedDecision.catch(() => undefined);
    await flushMicrotasks();

    expect(outcome).not.toHaveBeenCalled();
    expect(vaultSign).toHaveBeenCalledTimes(1);

    signResult.resolve({ prefixSig: 'sig' });
    await decision;
    await flushMicrotasks();

    expect(outcome).toHaveBeenCalledWith('resolved', { prefixSig: 'sig' });
    await expect(repeatedDecision).rejects.toThrow('Confirmation is already being processed');
  });

  it('keeps the confirmation open for a retry when the vault fails before the auto-decline deadline', async () => {
    const vaultSendOperations = jest
      .fn()
      .mockRejectedValueOnce(new Error('RPC unreachable'))
      .mockResolvedValueOnce({ hash: 'opHash', results: [] });
    unlockWithVault({ revealPublicKey: jest.fn(() => Promise.resolve('edpk')), sendOperations: vaultSendOperations });

    const outcome = settleOutcome(
      sendOperations(uiPort, confirmationId, testAccount.publicKeyHash, networkRpc, [
        { kind: 'transaction', to: testAccount.publicKeyHash, amount: 1 }
      ])
    );
    await flushMicrotasks();

    await expect(deliver(decisionReq)).rejects.toThrow('RPC unreachable');
    await flushMicrotasks();
    expect(outcome).not.toHaveBeenCalled();

    await deliver(decisionReq);
    await flushMicrotasks();

    expect(vaultSendOperations).toHaveBeenCalledTimes(2);
    expect(outcome).toHaveBeenCalledWith('resolved', { opHash: 'opHash' });
  });

  it('settles and closes the confirmation when the vault fails after the auto-decline deadline', async () => {
    const sendResult = createDeferred<{ hash: string; results: any[] }>();
    unlockWithVault({
      revealPublicKey: jest.fn(() => Promise.resolve('edpk')),
      sendOperations: jest.fn(() => sendResult.promise)
    });

    const outcome = settleOutcome(
      sendOperations(uiPort, confirmationId, testAccount.publicKeyHash, networkRpc, [
        { kind: 'transaction', to: testAccount.publicKeyHash, amount: 1 }
      ])
    );
    await flushMicrotasks();

    const decision = deliver(decisionReq);
    await flushMicrotasks();

    jest.advanceTimersByTime(IN_WALLET_CONFIRMATION_AUTODECLINE_MS + 1);
    sendResult.reject(new Error('RPC unreachable'));

    await expect(decision).rejects.toThrow('RPC unreachable');
    await flushMicrotasks();

    expect(outcome).toHaveBeenCalledWith('rejected', 'Declined');
    expect(intercom.notify).toHaveBeenCalledWith(uiPort, {
      type: TempleMessageType.ConfirmationExpired,
      id: confirmationId
    });
    expect(handlers).toHaveLength(0);
  });
});
