import { MavrykWalletDAppErrorType, MavrykWalletDAppMessageType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import browser, { Runtime } from 'webextension-polyfill';

import { IntercomPortKind } from 'lib/intercom';
import * as Beacon from 'lib/temple/beacon';
import { TempleMessageType } from 'lib/temple/types';

import { DAPP_CONFIRMATION_AUTODECLINE_MS } from './constants';
import { consumeConfirmToken, getAllDApps, removeDAppSessionsForPkhs, requestOperation } from './dapp';
import { assertBranchNotOnBuiltInChain } from './dapp-network';
import { intercom } from './defaults';
import { dryRunOpParams } from './dryrun';
import { inited, locked, unlocked } from './store';

jest.mock('lib/temple/beacon', () => ({
  ...jest.requireActual('lib/temple/beacon'),
  removeDAppPublicKey: jest.fn()
}));

jest.mock('lib/temple/helpers', () => ({
  ...jest.requireActual('lib/temple/helpers'),
  loadChainId: jest.fn(() => Promise.reject(new Error('offline'))),
  loadChainIdStrict: jest.fn(() => Promise.resolve('NetXunknownChain'))
}));

const VERIFIED_DRY_RUN = {
  result: {
    bytesToSign: 'deadbeef',
    rawToSign: { branch: 'BL', contents: [] },
    estimates: [],
    opParams: []
  }
};

jest.mock('./dryrun', () => ({
  ...jest.requireActual('./dryrun'),
  dryRunOpParams: jest.fn(() => Promise.resolve(VERIFIED_DRY_RUN))
}));

jest.mock('./dapp-network', () => ({
  ...jest.requireActual('./dapp-network'),
  assertBranchNotOnBuiltInChain: jest.fn(() => Promise.resolve())
}));

const mockedRemoveDAppPublicKey = Beacon.removeDAppPublicKey as jest.MockedFunction<typeof Beacon.removeDAppPublicKey>;
const mockedDryRunOpParams = dryRunOpParams as jest.MockedFunction<typeof dryRunOpParams>;
const mockedAssertBranchNotOnBuiltInChain = assertBranchNotOnBuiltInChain as jest.MockedFunction<
  typeof assertBranchNotOnBuiltInChain
>;

describe('consumeConfirmToken', () => {
  it('accepts a matching token once', () => {
    const result = consumeConfirmToken('token-1', 'token-1');

    expect(result).toEqual({
      isValid: true,
      nextToken: null
    });
  });

  it('rejects missing and mismatched tokens without consuming the expected token', () => {
    expect(consumeConfirmToken('token-1')).toEqual({
      isValid: false,
      nextToken: 'token-1'
    });
    expect(consumeConfirmToken('token-1', 'token-2')).toEqual({
      isValid: false,
      nextToken: 'token-1'
    });
  });

  it('rejects token reuse after consumption', () => {
    const consumed = consumeConfirmToken('token-1', 'token-1');

    expect(consumeConfirmToken(consumed.nextToken, 'token-1')).toEqual({
      isValid: false,
      nextToken: null
    });
  });
});

describe('removeDAppSessionsForPkhs', () => {
  const buildSession = (pkh: string) => ({ network: 'mainnet', appMeta: { name: 'dApp' }, pkh, publicKey: 'edpk' });
  const sessions = {
    'https://a.example': buildSession('mv1A'),
    'https://b.example': buildSession('mv1B'),
    'https://c.example': buildSession('mv1A')
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await browser.storage.local.clear();
    await browser.storage.local.set({ dapp_sessions: sessions });
  });

  it('drops every session bound to a removed pkh and its Beacon key', async () => {
    await removeDAppSessionsForPkhs(['mv1A']);

    expect(await getAllDApps()).toEqual({ 'https://b.example': sessions['https://b.example'] });
    expect(mockedRemoveDAppPublicKey.mock.calls).toEqual([['https://a.example'], ['https://c.example']]);
  });

  it('leaves the sessions untouched when no removed pkh has one', async () => {
    await removeDAppSessionsForPkhs(['mv1Z']);

    expect(await getAllDApps()).toEqual(sessions);
    expect(mockedRemoveDAppPublicKey).not.toHaveBeenCalled();
  });
});

describe('requestConfirm decision finalisation', () => {
  const ORIGIN = 'https://dapp.example';
  const PKH = 'mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G';
  const CONFIRM_WIN_ID = 7;
  const confirmPort = {} as Runtime.Port;
  const confirmPortInfo = { kind: IntercomPortKind.ConfirmUi };

  type Handler = (req: any, port: Runtime.Port, portInfo: any) => Promise<any>;

  let handlers: Handler[];
  let winRemovedListeners: Array<(winId: number) => void>;
  let windowsApi: Record<string, any>;

  const flushMicrotasks = async () => {
    for (let i = 0; i < 50; i++) await Promise.resolve();
  };

  const createDeferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  };

  // webextension-polyfill may drive the underlying chrome-style API through a trailing callback.
  const callbackApi = (getValue: (...args: any[]) => unknown) =>
    jest.fn((...args: any[]) => {
      const callback = args[args.length - 1];
      if (typeof callback !== 'function') return Promise.resolve(getValue(...args));

      return callback(getValue(...args.slice(0, -1)));
    });

  const deliver = (req: any) => Promise.all(handlers.map(handler => handler(req, confirmPort, confirmPortInfo)));

  const startOperationRequest = async () => {
    const outcome = jest.fn();
    requestOperation(ORIGIN, {
      type: MavrykWalletDAppMessageType.OperationRequest,
      sourcePkh: PKH,
      opParams: [{ kind: 'transaction', to: PKH, amount: 1 }]
    }).then(
      res => outcome('resolved', res),
      err => outcome('rejected', err.message)
    );
    await flushMicrotasks();

    const { url } = windowsApi.create.mock.calls[0][0];
    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    const id = params.get('id')!;
    await deliver({ type: TempleMessageType.DAppGetPayloadRequest, id, token: params.get('token') });

    return { id, outcome };
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    inited(true);
    await browser.storage.local.clear();
    await browser.storage.local.set({
      dapp_sessions: {
        [ORIGIN]: {
          network: { name: 'Custom', rpc: 'https://rpc.example' },
          chainId: 'NetXunknownChain',
          appMeta: { name: 'dApp' },
          pkh: PKH,
          publicKey: 'edpk'
        }
      }
    });

    handlers = [];
    winRemovedListeners = [];
    jest.spyOn(intercom, 'onRequest').mockImplementation(handler => {
      handlers.push(handler);
      return () => {
        handlers = handlers.filter(h => h !== handler);
      };
    });

    windowsApi = {
      create: callbackApi(() => ({ id: CONFIRM_WIN_ID })),
      get: callbackApi((winId: number) => ({ id: winId })),
      remove: callbackApi(() => undefined),
      update: callbackApi(() => undefined),
      getLastFocused: callbackApi(() => ({})),
      onRemoved: {
        addListener: jest.fn((listener: (winId: number) => void) => winRemovedListeners.push(listener)),
        removeListener: jest.fn((listener: (winId: number) => void) => {
          winRemovedListeners = winRemovedListeners.filter(l => l !== listener);
        })
      }
    };
    Object.assign(browser, { windows: windowsApi });
    Object.assign(browser.runtime, { getPlatformInfo: callbackApi(() => ({ os: 'mac' })) });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    locked();
  });

  it('does not decline a confirmed operation while the vault is still signing and broadcasting', async () => {
    const sendResult = createDeferred<{ hash: string; results: any[] }>();
    const sendOperations = jest.fn(() => sendResult.promise);
    unlocked({ vault: { sendOperations } as any, accounts: [], settings: {} });

    const { id, outcome } = await startOperationRequest();
    const decision = deliver({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: true });
    await flushMicrotasks();

    jest.advanceTimersByTime(DAPP_CONFIRMATION_AUTODECLINE_MS + 1);
    winRemovedListeners.forEach(listener => listener(CONFIRM_WIN_ID));
    await flushMicrotasks();

    expect(outcome).not.toHaveBeenCalled();
    expect(windowsApi.remove).not.toHaveBeenCalled();

    sendResult.resolve({ hash: 'opHash', results: [] });
    await decision;
    await flushMicrotasks();

    expect(outcome).toHaveBeenCalledTimes(1);
    expect(outcome).toHaveBeenCalledWith('resolved', {
      type: MavrykWalletDAppMessageType.OperationResponse,
      opHash: 'opHash'
    });
    expect(windowsApi.remove.mock.calls.map(([winId]: [number]) => winId)).toEqual([CONFIRM_WIN_ID]);
  });

  it('rejects a second decision for the same id while the first is in flight', async () => {
    const sendResult = createDeferred<{ hash: string; results: any[] }>();
    const sendOperations = jest.fn(() => sendResult.promise);
    unlocked({ vault: { sendOperations } as any, accounts: [], settings: {} });

    const { id } = await startOperationRequest();
    const decision = deliver({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: true });
    await flushMicrotasks();

    const repeatedDecision = deliver({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: true });
    repeatedDecision.catch(() => undefined);
    await flushMicrotasks();

    expect(sendOperations).toHaveBeenCalledTimes(1);

    sendResult.resolve({ hash: 'opHash', results: [] });
    await decision;
    await expect(repeatedDecision).rejects.toThrow('Confirmation is already being processed');
  });

  it('settles and closes the confirmation when the vault fails after the auto-decline deadline', async () => {
    const sendResult = createDeferred<{ hash: string; results: any[] }>();
    unlocked({ vault: { sendOperations: jest.fn(() => sendResult.promise) } as any, accounts: [], settings: {} });

    const { id, outcome } = await startOperationRequest();
    const decision = deliver({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: true });
    await flushMicrotasks();

    jest.advanceTimersByTime(DAPP_CONFIRMATION_AUTODECLINE_MS + 1);
    sendResult.reject(new Error('RPC unreachable'));

    await expect(decision).rejects.toThrow('RPC unreachable');
    await flushMicrotasks();

    expect(outcome).toHaveBeenCalledWith('rejected', MavrykWalletDAppErrorType.NotGranted);
    expect(windowsApi.remove.mock.calls.map(([winId]: [number]) => winId)).toEqual([CONFIRM_WIN_ID]);
    expect(handlers).toHaveLength(0);
  });

  it('still auto-declines when a decision of the wrong type is sent for the same id', async () => {
    const sendOperations = jest.fn();
    unlocked({ vault: { sendOperations } as any, accounts: [], settings: {} });

    const { id, outcome } = await startOperationRequest();
    await expect(
      deliver({ type: TempleMessageType.DAppSignConfirmationRequest, id, confirmed: true })
    ).resolves.toEqual([undefined]);

    jest.advanceTimersByTime(DAPP_CONFIRMATION_AUTODECLINE_MS + 1);
    await flushMicrotasks();

    expect(sendOperations).not.toHaveBeenCalled();
    expect(outcome).toHaveBeenCalledWith('rejected', MavrykWalletDAppErrorType.NotGranted);
    expect(windowsApi.remove.mock.calls.map(([winId]: [number]) => winId)).toEqual([CONFIRM_WIN_ID]);
    expect(handlers).toHaveLength(0);
  });
  it.each([
    ['an error', { error: [new Error('estimate failed')] }],
    ['nothing', null]
  ])('refuses to sign when the dry-run returned %s instead of the forged operation', async (_label, dryRun) => {
    mockedDryRunOpParams.mockResolvedValueOnce(dryRun);
    const sendOperations = jest.fn();
    unlocked({ vault: { sendOperations } as any, accounts: [], settings: {} });

    const { id, outcome } = await startOperationRequest();
    await expect(deliver({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: true })).rejects.toThrow(
      MavrykWalletDAppErrorType.InvalidParams
    );
    await flushMicrotasks();

    expect(sendOperations).not.toHaveBeenCalled();
    expect(outcome).not.toHaveBeenCalled();

    await deliver({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: false });
    await flushMicrotasks();

    expect(outcome).toHaveBeenCalledWith('rejected', MavrykWalletDAppErrorType.NotGranted);
    expect(windowsApi.remove.mock.calls.map(([winId]: [number]) => winId)).toEqual([CONFIRM_WIN_ID]);
  });

  it.each([
    ['the confirm window is closed', () => winRemovedListeners.forEach(listener => listener(CONFIRM_WIN_ID))],
    ['the auto-decline deadline passes', () => jest.advanceTimersByTime(DAPP_CONFIRMATION_AUTODECLINE_MS + 1)]
  ])('does not sign when %s while the operation is being verified', async (_label, declineDuringVerification) => {
    const verification = createDeferred<void>();
    mockedAssertBranchNotOnBuiltInChain.mockClear().mockReturnValueOnce(verification.promise);
    const sign = jest.fn();
    // Stands in for the vault: the signer only signs once beforeSign has passed the operation bytes.
    const sendOperations = jest.fn(async (...args: any[]) => {
      await args[3]('00'.repeat(32));
      sign();
      return { hash: 'opHash', results: [] };
    });
    unlocked({ vault: { sendOperations } as any, accounts: [], settings: {} });

    const { id, outcome } = await startOperationRequest();
    const decision = deliver({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: true });
    decision.catch(() => undefined);
    await flushMicrotasks();
    expect(mockedAssertBranchNotOnBuiltInChain).toHaveBeenCalledTimes(1);

    declineDuringVerification();
    verification.resolve();

    await expect(decision).rejects.toThrow(MavrykWalletDAppErrorType.NotGranted);
    await flushMicrotasks();

    expect(sign).not.toHaveBeenCalled();
    expect(outcome).toHaveBeenCalledWith('rejected', MavrykWalletDAppErrorType.NotGranted);
    expect(handlers).toHaveLength(0);
  });

  it('signs a verified operation when nothing declined it during verification', async () => {
    const sign = jest.fn();
    const sendOperations = jest.fn(async (...args: any[]) => {
      await args[3]('00'.repeat(32));
      sign();
      return { hash: 'opHash', results: [] };
    });
    unlocked({ vault: { sendOperations } as any, accounts: [], settings: {} });

    const { id, outcome } = await startOperationRequest();
    await deliver({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: true });
    await flushMicrotasks();

    expect(sign).toHaveBeenCalledTimes(1);
    expect(outcome).toHaveBeenCalledWith('resolved', {
      type: MavrykWalletDAppMessageType.OperationResponse,
      opHash: 'opHash'
    });
  });

  it('signs the confirmed operation when the dry-run produced the forged operation', async () => {
    const sendOperations = jest.fn(() => Promise.resolve({ hash: 'opHash', results: [] }));
    unlocked({ vault: { sendOperations } as any, accounts: [], settings: {} });

    const { id, outcome } = await startOperationRequest();
    await deliver({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: true });
    await flushMicrotasks();

    expect(sendOperations).toHaveBeenCalledTimes(1);
    expect(outcome).toHaveBeenCalledWith('resolved', {
      type: MavrykWalletDAppMessageType.OperationResponse,
      opHash: 'opHash'
    });
  });
});
