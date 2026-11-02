import { MavrykWalletDAppErrorType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import { HttpResponseError, STATUS_CODE } from '@mavrykdynamics/webmavryk-http-utils';
import { RpcClient } from '@mavrykdynamics/webmavryk-rpc';
import BigNumber from 'bignumber.js';
import browser from 'webextension-polyfill';

import { loadChainId, loadChainIdStrict } from 'lib/temple/helpers';
import { NETWORK_IDS, NETWORKS } from 'lib/temple/networks';
import { TempleMessageType } from 'lib/temple/types';
import { delay } from 'lib/utils';

import {
  getAllDApps,
  getCurrentPermission,
  requestBroadcast,
  requestOperation,
  requestPermission,
  requestSign
} from './dapp';
import { assertBranchNotOnBuiltInChain, DAPP_RPC_CHAIN_ID_TIMEOUT_MS } from './dapp-network';
import { enqueueDAppForOrigin } from './dapp-queue';
import { intercom } from './defaults';
import { dryRunOpParams } from './dryrun';
import { withUnlocked } from './store';

jest.mock('lib/temple/helpers', () => ({
  ...jest.requireActual('lib/temple/helpers'),
  loadChainId: jest.fn(),
  loadChainIdStrict: jest.fn()
}));

jest.mock('lib/utils', () => ({
  ...jest.requireActual('lib/utils'),
  delay: jest.fn(() => Promise.resolve())
}));

jest.mock('./defaults', () => ({
  intercom: { onRequest: jest.fn(), broadcast: jest.fn() }
}));

jest.mock('./intercom-permissions', () => ({
  assertConfirmUiPortInfo: jest.fn()
}));

jest.mock('./dryrun', () => ({
  ...jest.requireActual('./dryrun'),
  dryRunOpParams: jest.fn()
}));

jest.mock('./store', () => ({
  ...jest.requireActual('./store'),
  withUnlocked: jest.fn()
}));

const mockedLoadChainId = loadChainId as jest.MockedFunction<typeof loadChainId>;
const mockedLoadChainIdStrict = loadChainIdStrict as jest.MockedFunction<typeof loadChainIdStrict>;
const mockedOnRequest = intercom.onRequest as jest.MockedFunction<typeof intercom.onRequest>;
const mockedDryRunOpParams = dryRunOpParams as jest.MockedFunction<typeof dryRunOpParams>;
const mockedWithUnlocked = withUnlocked as jest.MockedFunction<typeof withUnlocked>;
const mockedDelay = delay as jest.MockedFunction<typeof delay>;
const mockedBroadcast = intercom.broadcast as jest.MockedFunction<typeof intercom.broadcast>;
const getBlockHash = jest.spyOn(RpcClient.prototype, 'getBlockHash');
const getBlockHeader = jest.spyOn(RpcClient.prototype, 'getBlockHeader');
const getConstants = jest.spyOn(RpcClient.prototype, 'getConstants');

afterAll(() => jest.restoreAllMocks());

const ORIGIN = 'https://dapp.example';
const APP_META = { name: 'dApp' };
const ACCOUNT_PKH = 'mv1N3KY1vXdYX2x568MGmNBRLEK7k7uc2zEM';
const ACCOUNT_PUBLIC_KEY = 'edpkTest';
const MAINNET_CHAIN_ID = 'NetXXAAR1wWQhhe';
const BASENET_CHAIN_ID = 'NetXmtMsNf69w1w';
const UNKNOWN_CHAIN_ID = 'NetXunknownChain';
const MAINNET_RPC = NETWORKS.find(n => n.id === 'mainnet')!.rpcBaseURL;
const SECRET_RPC = 'https://user:pw@node.example/?key=SECRET';
const OP_BYTES = '00'.repeat(32) + '6c00';
const BUILT_IN_COUNT = NETWORKS.filter(n => Array.from(NETWORK_IDS.values()).includes(n.id)).length;

const notFound = () => new HttpResponseError('not found', STATUS_CODE.NOT_FOUND, 'Not Found', '', 'url');
/** Every built-in node reports a head this old, on a chain with a 10 s minimal block delay. */
const mockBuiltInHeads = (ageMs: number) => {
  getBlockHeader.mockResolvedValue({ timestamp: new Date(Date.now() - ageMs).toISOString() } as any);
  getConstants.mockResolvedValue({ minimal_block_delay: new BigNumber(10) } as any);
};

/** A mock that serves both the callback-style chrome API (wrapped by the polyfill) and direct promise calls. */
const chromeApiMock = (value: unknown) =>
  jest.fn((...args: unknown[]) => {
    const callback = args.find((arg): arg is (result: unknown) => void => typeof arg === 'function');
    callback?.(value);
    return Promise.resolve(value);
  });

// Installed once: the polyfill caches its wrapper around the first `chrome.windows` object it sees.
const windowsCreate = chromeApiMock({ id: 1 });
Object.assign((global as any).chrome, {
  windows: {
    create: windowsCreate,
    get: chromeApiMock({ id: 1 }),
    remove: chromeApiMock(undefined),
    update: chromeApiMock(undefined),
    getLastFocused: chromeApiMock(undefined),
    onRemoved: { addListener: jest.fn(), removeListener: jest.fn(), hasListener: jest.fn() }
  }
});
Object.assign((global as any).chrome.runtime, { getPlatformInfo: chromeApiMock({ os: 'mac' }) });

const waitForConfirmWindow = async () => {
  for (let i = 0; i < 50 && windowsCreate.mock.calls.length === 0; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const [{ url }] = windowsCreate.mock.calls[0] as [{ url: string }];
  const params = new URLSearchParams(url.split('#?')[1]);
  const handler = mockedOnRequest.mock.calls[0][0] as (...args: any[]) => Promise<any>;

  return { id: params.get('id')!, token: params.get('token')!, handler };
};

/** Opens the connect prompt, reads its payload as the confirm UI would, and approves it. */
const approveConnect = async (permissionPromise: Promise<any>) => {
  const { id, token, handler } = await waitForConfirmWindow();
  const port = {};
  const { payload } = await handler({ type: TempleMessageType.DAppGetPayloadRequest, id, token }, port, {});
  await handler(
    {
      type: TempleMessageType.DAppPermConfirmationRequest,
      id,
      confirmed: true,
      accountPublicKeyHash: ACCOUNT_PKH,
      accountPublicKey: ACCOUNT_PUBLIC_KEY
    },
    port,
    {}
  );

  return { payload, response: await permissionPromise };
};

/** Reads the operation prompt's payload as the confirm UI would, approves it, and returns the vault call. */
const approveOperation = async (operationPromise: Promise<any>) => {
  const sendOperations = jest.fn().mockResolvedValue({ hash: 'ooHash', results: [] });
  mockedWithUnlocked.mockImplementation(fn => (fn as any)({ vault: { sendOperations } }));
  const { id, token, handler } = await waitForConfirmWindow();
  const port = {};
  const { payload } = await handler({ type: TempleMessageType.DAppGetPayloadRequest, id, token }, port, {});
  await handler({ type: TempleMessageType.DAppOpsConfirmationRequest, id, confirmed: true }, port, {});

  return { id, payload, response: await operationPromise, sendOperations };
};

const OPERATION_REQUEST = {
  sourcePkh: ACCOUNT_PKH,
  opParams: [{ kind: 'transaction', to: ACCOUNT_PKH, amount: 1 }]
} as any;

const setCurrentNetwork = (rpcBaseURL: string, isCustom: boolean, builtInId = 'mainnet') =>
  browser.storage.local.set({
    network_id: isCustom ? rpcBaseURL : builtInId,
    custom_networks_snapshot: isCustom
      ? [{ id: rpcBaseURL, rpcBaseURL, name: 'My node', type: 'main', color: '#000', disabled: false }]
      : []
  });

describe('dApp custom RPC chain binding', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await browser.storage.local.clear();
    mockedOnRequest.mockReturnValue(() => undefined);
    await setCurrentNetwork(MAINNET_RPC, false);
    mockedLoadChainId.mockResolvedValue(MAINNET_CHAIN_ID);
    // A locally forged preview, which approving an operation requires.
    mockedDryRunOpParams.mockResolvedValue({
      result: { bytesToSign: 'deadbeef', rawToSign: { branch: 'BL', contents: [] }, estimates: [] }
    } as any);
  });

  it('rejects a plain-http custom RPC on a non-loopback host', async () => {
    mockedLoadChainIdStrict.mockResolvedValue(UNKNOWN_CHAIN_ID);

    await expect(
      requestPermission(ORIGIN, { network: { name: 'Evil', rpc: 'http://evil.example' }, appMeta: APP_META } as any)
    ).rejects.toThrow(MavrykWalletDAppErrorType.InvalidParams);
    expect(windowsCreate).not.toHaveBeenCalled();
  });

  it.each([
    'https://victim.internal/anything?x=',
    'https://victim.internal/anything#x',
    'https://user:pw@victim.internal',
    'http://localhost:9000/admin?'
  ])('rejects the custom RPC %s without contacting it', async rpc => {
    await expect(
      requestPermission(ORIGIN, { network: { name: 'Probe', rpc }, appMeta: APP_META } as any)
    ).rejects.toThrow(MavrykWalletDAppErrorType.InvalidParams);
    expect(mockedLoadChainIdStrict).not.toHaveBeenCalled();
    expect(windowsCreate).not.toHaveBeenCalled();
  });

  it('contacts a custom RPC only once the prompt is open, and rejects one whose chain id does not resolve', async () => {
    mockedLoadChainIdStrict.mockRejectedValue(new Error('ECONNREFUSED'));
    const permission = requestPermission(ORIGIN, {
      network: { name: 'Down', rpc: 'https://down.example' },
      appMeta: APP_META
    } as any);

    const { id, token, handler } = await waitForConfirmWindow();
    expect(mockedLoadChainIdStrict).not.toHaveBeenCalled();

    await expect(handler({ type: TempleMessageType.DAppGetPayloadRequest, id, token }, {}, {})).rejects.toThrow();
    await expect(permission).rejects.toThrow(MavrykWalletDAppErrorType.InvalidParams);
    expect(await getAllDApps()).toEqual({});
  });

  it("routes a custom RPC serving the current network's chain to the user's own RPC", async () => {
    mockedLoadChainIdStrict.mockResolvedValue(MAINNET_CHAIN_ID);
    const network = { name: 'Proxy', rpc: 'https://proxy.example/' };

    const { payload, response } = await approveConnect(
      requestPermission(ORIGIN, { network, appMeta: APP_META } as any)
    );

    expect(mockedLoadChainIdStrict).toHaveBeenCalledWith('https://proxy.example');
    expect(payload.networkRpc).toBe(MAINNET_RPC);
    expect(response.rpc).toBe('https://proxy.example');
    expect((await getAllDApps())[ORIGIN]).toEqual(expect.objectContaining({ network, chainId: MAINNET_CHAIN_ID }));
  });

  it("routes a custom RPC reporting mainnet to mainnet's public RPC while the user is on basenet", async () => {
    await setCurrentNetwork(NETWORKS.find(n => n.id === 'basenet')!.rpcBaseURL, false, 'basenet');
    mockedLoadChainId.mockResolvedValue(BASENET_CHAIN_ID);
    mockedLoadChainIdStrict.mockResolvedValue(MAINNET_CHAIN_ID);
    const network = { name: 'Proxy', rpc: 'https://proxy.example' };

    const { payload } = await approveConnect(requestPermission(ORIGIN, { network, appMeta: APP_META } as any));

    expect(payload.networkRpc).toBe(MAINNET_RPC);
    expect((await getAllDApps())[ORIGIN]).toEqual(expect.objectContaining({ network, chainId: MAINNET_CHAIN_ID }));
  });

  it('keeps a custom RPC on an unknown chain and binds the session to that chain id', async () => {
    mockedLoadChainIdStrict.mockResolvedValue(UNKNOWN_CHAIN_ID);
    const network = { name: 'Local', rpc: 'http://localhost:8732' };

    const { payload } = await approveConnect(requestPermission(ORIGIN, { network, appMeta: APP_META } as any));

    expect(payload.networkRpc).toBe('http://localhost:8732');
    expect(payload.chainId).toBe(UNKNOWN_CHAIN_ID);
    expect((await getAllDApps())[ORIGIN]).toEqual({
      network,
      chainId: UNKNOWN_CHAIN_ID,
      appMeta: APP_META,
      pkh: ACCOUNT_PKH,
      publicKey: ACCOUNT_PUBLIC_KEY
    });
  });

  describe('after permission', () => {
    const session = {
      network: { name: 'Custom', rpc: 'https://custom.example' },
      chainId: UNKNOWN_CHAIN_ID,
      appMeta: APP_META,
      pkh: ACCOUNT_PKH,
      publicKey: ACCOUNT_PUBLIC_KEY
    };

    beforeEach(async () => {
      await browser.storage.local.set({ dapp_sessions: { [ORIGIN]: session } });
    });

    it("rejects an operation once the RPC's chain id changed", async () => {
      mockedLoadChainIdStrict.mockResolvedValue('NetXswitchedChain');

      await expect(
        requestOperation(ORIGIN, {
          sourcePkh: ACCOUNT_PKH,
          opParams: [{ kind: 'transaction', to: ACCOUNT_PKH, amount: 1 }]
        } as any)
      ).rejects.toThrow(MavrykWalletDAppErrorType.InvalidParams);
      expect(windowsCreate).not.toHaveBeenCalled();
    });

    it("rejects a broadcast once the RPC's chain id changed", async () => {
      mockedLoadChainIdStrict.mockResolvedValue('NetXswitchedChain');

      await expect(requestBroadcast(ORIGIN, { signedOpBytes: 'deadbeef' } as any)).rejects.toThrow(
        MavrykWalletDAppErrorType.InvalidParams
      );
    });

    it('shows the bound chain id and guards the branch before signing for an unknown chain', async () => {
      mockedLoadChainIdStrict.mockResolvedValue(UNKNOWN_CHAIN_ID);

      const { payload, response, sendOperations } = await approveOperation(requestOperation(ORIGIN, OPERATION_REQUEST));

      expect(payload).toEqual(
        expect.objectContaining({ networkRpc: 'https://custom.example', chainId: UNKNOWN_CHAIN_ID })
      );
      expect(response.opHash).toBe('ooHash');
      expect(sendOperations).toHaveBeenCalledWith(
        ACCOUNT_PKH,
        'https://custom.example',
        OPERATION_REQUEST.opParams,
        expect.any(Function)
      );

      mockBuiltInHeads(1_000);
      getBlockHash.mockReset().mockResolvedValue('BLockHash');
      await expect(sendOperations.mock.calls[0][3](OP_BYTES)).rejects.toThrow('known Mavryk network');
    });

    it('tells the confirm window while the operation branch is being verified', async () => {
      mockedLoadChainIdStrict.mockResolvedValue(UNKNOWN_CHAIN_ID);
      const { id, sendOperations } = await approveOperation(requestOperation(ORIGIN, OPERATION_REQUEST));
      mockBuiltInHeads(1_000);
      getBlockHash.mockReset().mockRejectedValue(notFound());

      await expect(sendOperations.mock.calls[0][3](OP_BYTES)).resolves.toBeUndefined();

      const verifyingNotices = mockedBroadcast.mock.calls
        .map(([msg]) => msg)
        .filter(msg => msg?.type === TempleMessageType.DAppOpsVerifying);
      expect(verifyingNotices).toEqual([
        { type: TempleMessageType.DAppOpsVerifying, id, verifying: true },
        { type: TempleMessageType.DAppOpsVerifying, id, verifying: false }
      ]);
    });
  });

  it('signs for a custom-RPC session bound to mainnet through the public RPC, with no branch guard', async () => {
    await browser.storage.local.set({
      dapp_sessions: {
        [ORIGIN]: {
          network: { name: 'Proxy', rpc: 'https://proxy.example' },
          chainId: MAINNET_CHAIN_ID,
          appMeta: APP_META,
          pkh: ACCOUNT_PKH,
          publicKey: ACCOUNT_PUBLIC_KEY
        }
      }
    });
    await setCurrentNetwork(NETWORKS.find(n => n.id === 'basenet')!.rpcBaseURL, false, 'basenet');
    mockedLoadChainId.mockResolvedValue(BASENET_CHAIN_ID);
    mockedLoadChainIdStrict.mockResolvedValue(MAINNET_CHAIN_ID);

    const { sendOperations } = await approveOperation(requestOperation(ORIGIN, OPERATION_REQUEST));

    expect(sendOperations).toHaveBeenCalledWith(ACCOUNT_PKH, MAINNET_RPC, OPERATION_REQUEST.opParams, undefined);
  });

  it('signs for a local-node session through the selected wallet network, with no branch guard', async () => {
    const sandboxRpc = NETWORKS.find(n => n.id === 'sandbox')!.rpcBaseURL;
    await browser.storage.local.set({
      dapp_sessions: {
        [ORIGIN]: {
          network: { name: 'Local', rpc: 'http://127.0.0.1:8732' },
          chainId: UNKNOWN_CHAIN_ID,
          appMeta: APP_META,
          pkh: ACCOUNT_PKH,
          publicKey: ACCOUNT_PUBLIC_KEY
        }
      }
    });
    await setCurrentNetwork(sandboxRpc, false, 'sandbox');
    mockedLoadChainId.mockResolvedValue(UNKNOWN_CHAIN_ID);
    mockedLoadChainIdStrict.mockResolvedValue(UNKNOWN_CHAIN_ID);

    const { sendOperations } = await approveOperation(requestOperation(ORIGIN, OPERATION_REQUEST));

    expect(sendOperations).toHaveBeenCalledWith(ACCOUNT_PKH, sandboxRpc, OPERATION_REQUEST.opParams, undefined);
  });

  describe('a dApp RPC that never answers', () => {
    const OTHER_ORIGIN = 'https://other.example';
    const neverAnswers = () => new Promise<string>(() => undefined);
    const isDAppEnabled = async () => true;
    const flushMicrotasks = async () => {
      for (let i = 0; i < 100; i++) await Promise.resolve();
    };

    beforeEach(async () => {
      await browser.storage.local.set({
        dapp_sessions: {
          [ORIGIN]: {
            network: { name: 'Tarpit', rpc: 'https://tarpit.example' },
            chainId: UNKNOWN_CHAIN_ID,
            appMeta: APP_META,
            pkh: ACCOUNT_PKH,
            publicKey: ACCOUNT_PUBLIC_KEY
          }
        }
      });
    });

    afterEach(() => {
      jest.useRealTimers();
      mockedLoadChainIdStrict.mockReset();
    });

    it.each([
      ['its chain id lookup', () => mockedLoadChainIdStrict.mockImplementation(neverAnswers)],
      [
        'the session chain id check',
        () => mockedLoadChainIdStrict.mockResolvedValueOnce(UNKNOWN_CHAIN_ID).mockImplementation(neverAnswers)
      ]
    ])('times out %s so requests from other origins queued behind it still proceed', async (_label, tarpit) => {
      jest.useFakeTimers();
      tarpit();
      const stalled = enqueueDAppForOrigin(ORIGIN, () => requestOperation(ORIGIN, OPERATION_REQUEST), isDAppEnabled);
      stalled.catch(() => undefined);
      const otherOriginRequest = jest.fn().mockResolvedValue('served');
      const queued = enqueueDAppForOrigin(OTHER_ORIGIN, otherOriginRequest, isDAppEnabled);

      await flushMicrotasks();
      expect(otherOriginRequest).not.toHaveBeenCalled();

      for (let i = 0; i < 2; i++) {
        jest.advanceTimersByTime(DAPP_RPC_CHAIN_ID_TIMEOUT_MS);
        await flushMicrotasks();
      }

      await expect(stalled).rejects.toThrow(MavrykWalletDAppErrorType.InvalidParams);
      await expect(queued).resolves.toBe('served');
      expect(windowsCreate).not.toHaveBeenCalled();
    });

    it('opens a sign prompt without contacting the dApp RPC', async () => {
      mockedLoadChainIdStrict.mockImplementation(neverAnswers);
      const signing = requestSign(ORIGIN, { sourcePkh: ACCOUNT_PKH, payload: '05010000000568656c6c6f' } as any);
      signing.catch(() => undefined);

      const { id, token, handler } = await waitForConfirmWindow();
      const { payload } = await handler({ type: TempleMessageType.DAppGetPayloadRequest, id, token }, {}, {});

      expect(payload.networkRpc).toBe('https://tarpit.example');
      expect(mockedLoadChainIdStrict).not.toHaveBeenCalled();
    });

    it("shows a sign prompt for a session bound to a built-in chain on that network's public RPC", async () => {
      await browser.storage.local.set({
        dapp_sessions: {
          [ORIGIN]: {
            network: { name: 'Proxy', rpc: 'https://proxy.example/' },
            chainId: MAINNET_CHAIN_ID,
            appMeta: APP_META,
            pkh: ACCOUNT_PKH,
            publicKey: ACCOUNT_PUBLIC_KEY
          }
        }
      });
      mockedLoadChainIdStrict.mockImplementation(neverAnswers);
      const signing = requestSign(ORIGIN, { sourcePkh: ACCOUNT_PKH, payload: '05010000000568656c6c6f' } as any);
      signing.catch(() => undefined);

      const { id, token, handler } = await waitForConfirmWindow();
      const { payload } = await handler({ type: TempleMessageType.DAppGetPayloadRequest, id, token }, {}, {});

      expect(payload.networkRpc).toBe(MAINNET_RPC);
      expect(mockedLoadChainIdStrict).not.toHaveBeenCalled();
    });
  });

  describe('a custom-RPC session stored before chain binding', () => {
    beforeEach(async () => {
      await browser.storage.local.set({
        dapp_sessions: {
          [ORIGIN]: {
            network: { name: 'Legacy', rpc: 'http://legacy.example' },
            appMeta: APP_META,
            pkh: ACCOUNT_PKH,
            publicKey: ACCOUNT_PUBLIC_KEY
          }
        }
      });
    });

    it('is reported as not granted so the dApp reconnects', async () => {
      expect((await getCurrentPermission(ORIGIN)).permission).toBeNull();
      await expect(requestOperation(ORIGIN, OPERATION_REQUEST)).rejects.toThrow(MavrykWalletDAppErrorType.NotGranted);
      await expect(requestBroadcast(ORIGIN, { signedOpBytes: 'deadbeef' } as any)).rejects.toThrow(
        MavrykWalletDAppErrorType.NotGranted
      );
      expect(mockedLoadChainIdStrict).not.toHaveBeenCalled();
    });
  });
});

describe('assertBranchNotOnBuiltInChain', () => {
  beforeEach(() => {
    getBlockHash.mockReset();
    getBlockHeader.mockReset();
    getConstants.mockReset();
    mockedDelay.mockClear();
    mockBuiltInHeads(1_000);
  });

  it('allows a branch unknown to built-in nodes that are at the head, without waiting', async () => {
    getBlockHash.mockRejectedValue(notFound());

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).resolves.toBeUndefined();
    expect(getBlockHash).toHaveBeenCalledWith({ block: expect.stringMatching(/^B/) });
    expect(getBlockHash).toHaveBeenCalledTimes(BUILT_IN_COUNT);
    expect(getBlockHeader.mock.invocationCallOrder[0]).toBeLessThan(getBlockHash.mock.invocationCallOrder[0]);
    expect(mockedDelay).not.toHaveBeenCalled();
  });

  it('allows the branch once a node that may be behind the head has a head made after signing began', async () => {
    mockBuiltInHeads(60_000);
    getBlockHash.mockRejectedValue(notFound());
    mockedDelay.mockImplementationOnce(async () => mockBuiltInHeads(-5_000));

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).resolves.toBeUndefined();
    expect(getBlockHash).toHaveBeenCalledTimes(BUILT_IN_COUNT * 2);
    expect(mockedDelay).toHaveBeenCalledTimes(1);
    expect(getBlockHeader.mock.invocationCallOrder[BUILT_IN_COUNT]).toBeLessThan(
      getBlockHash.mock.invocationCallOrder[BUILT_IN_COUNT]
    );
  });

  it('refuses to sign when a node is still behind the head after the recheck delay', async () => {
    mockBuiltInHeads(60_000);
    getBlockHash.mockRejectedValue(notFound());

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).rejects.toThrow(
      'Could not verify the operation branch against Mavryk networks'
    );
    expect(getBlockHash).toHaveBeenCalledTimes(BUILT_IN_COUNT * 2);
    expect(mockedDelay).toHaveBeenCalledTimes(1);
  });

  it('refuses to sign when the recheck head is within the clock tolerance of signing', async () => {
    mockBuiltInHeads(60_000);
    getBlockHash.mockRejectedValue(notFound());
    mockedDelay.mockImplementationOnce(async () => mockBuiltInHeads(0));

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).rejects.toThrow('Signing was refused.');
  });

  it('looks the branch up again when a head is ahead of the local clock', async () => {
    mockBuiltInHeads(-10_000);
    getBlockHash.mockRejectedValue(notFound());

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).resolves.toBeUndefined();
    expect(mockedDelay).toHaveBeenCalledTimes(1);
  });

  it('refuses a branch that a built-in network knows', async () => {
    getBlockHash.mockRejectedValueOnce(notFound()).mockResolvedValue('BLockHash');

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).rejects.toThrow('known Mavryk network');
  });

  it('refuses a branch that a lagging built-in node only finds on the second lookup', async () => {
    mockBuiltInHeads(60_000);
    getBlockHash.mockImplementation(() =>
      getBlockHash.mock.calls.length <= BUILT_IN_COUNT ? Promise.reject(notFound()) : Promise.resolve('BLockHash')
    );

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).rejects.toThrow('known Mavryk network');
    expect(mockedDelay).toHaveBeenCalled();
  });

  it('fails closed with a connection message when a built-in network cannot answer', async () => {
    getBlockHash.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).rejects.toThrow(
      'Could not verify the operation branch against Mavryk networks; check your connection.'
    );
  });

  it("fails closed when a built-in network's head cannot be read", async () => {
    getBlockHeader.mockRejectedValue(new Error('ECONNREFUSED'));
    getBlockHash.mockRejectedValue(notFound());

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).rejects.toThrow('Signing was refused.');
    expect(mockedDelay).not.toHaveBeenCalled();
  });

  it('tells the user how to sign for a local node without the branch check', async () => {
    getBlockHash.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(assertBranchNotOnBuiltInChain(OP_BYTES)).rejects.toThrow(
      'To sign for a local node, select that node as the wallet network and try again.'
    );
  });
});

describe("dApp-visible RPC never discloses the user's custom network URL", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await browser.storage.local.clear();
    mockedOnRequest.mockReturnValue(() => undefined);
    await setCurrentNetwork(SECRET_RPC, true);
    mockedLoadChainId.mockResolvedValue(MAINNET_CHAIN_ID);
  });

  it('returns the built-in public RPC in the permission response while the prompt shows the user node', async () => {
    const { payload, response } = await approveConnect(
      requestPermission(ORIGIN, { network: 'mainnet', appMeta: APP_META } as any)
    );

    expect(payload.networkRpc).toBe(SECRET_RPC);
    expect(response.rpc).toBe(MAINNET_RPC);
    expect(response.rpc).not.toContain('SECRET');
  });

  it('returns the built-in public RPC for an existing session and from getCurrentPermission', async () => {
    await browser.storage.local.set({
      dapp_sessions: {
        [ORIGIN]: { network: 'mainnet', appMeta: APP_META, pkh: ACCOUNT_PKH, publicKey: ACCOUNT_PUBLIC_KEY }
      }
    });

    const response = await requestPermission(ORIGIN, { network: 'mainnet', appMeta: APP_META } as any);
    const { permission } = await getCurrentPermission(ORIGIN);

    expect(response.rpc).toBe(MAINNET_RPC);
    expect(permission?.rpc).toBe(MAINNET_RPC);
    expect(JSON.stringify([response, permission])).not.toContain('SECRET');
  });
});
