import { MavrykWalletDAppErrorType, MavrykWalletDAppMessageType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';
import browser, { Runtime } from 'webextension-polyfill';

import * as Beacon from 'lib/temple/beacon';

import { TempleSharedStorageKey } from '../types';

import { processDApp } from './actions';
import { processBeacon } from './beacon-dapp';
import { requestOperation, requestPermission, requestSign } from './dapp';
import { DAPP_TOO_MANY_PENDING_REQUESTS_ERROR } from './dapp-queue';
import { intercom } from './defaults';
import { inited, locked } from './store';
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

jest.mock('lib/temple/beacon', () => {
  const actual = jest.requireActual('lib/temple/beacon');

  return {
    ...actual,
    decodeMessage: jest.fn(actual.decodeMessage)
  };
});

jest.mock('./dapp', () => ({
  ...jest.requireActual('./dapp'),
  requestPermission: jest.fn(),
  requestOperation: jest.fn(),
  requestSign: jest.fn()
}));

jest.mock('./vault', () => ({
  Vault: {
    isExist: jest.fn()
  }
}));

const mockedVault = Vault as jest.Mocked<typeof Vault>;
const mockedDecodeMessage = Beacon.decodeMessage as jest.MockedFunction<typeof Beacon.decodeMessage>;
const mockedRequestPermission = requestPermission as jest.MockedFunction<typeof requestPermission>;
const mockedRequestOperation = requestOperation as jest.MockedFunction<typeof requestOperation>;
const mockedRequestSign = requestSign as jest.MockedFunction<typeof requestSign>;

const testPkh = 'mv1DXLvsp4T7X6gXLHn7szGN7WLooy14fQ3G';

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

describe('processDApp request queue gating', () => {
  const dAppOrigin = 'https://dapp.example';
  const otherOrigin = 'https://other.example';
  const permissionReq = {
    type: MavrykWalletDAppMessageType.PermissionRequest,
    network: 'mainnet',
    appMeta: { name: 'dApp' },
    force: true
  } as any;
  const operationReq = {
    type: MavrykWalletDAppMessageType.OperationRequest,
    sourcePkh: testPkh,
    opParams: []
  } as any;
  const signReq = {
    type: MavrykWalletDAppMessageType.SignRequest,
    sourcePkh: testPkh,
    payload: '05'
  } as any;
  const permissionRes = {
    type: MavrykWalletDAppMessageType.PermissionResponse,
    rpc: 'https://rpc.example',
    pkh: testPkh,
    publicKey: 'edpk-public-key'
  } as any;

  beforeEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
    locked();
    inited(true);
    await browser.storage.local.clear();
    await browser.storage.local.set({ [TempleSharedStorageKey.DAppEnabled]: true });
    mockedVault.isExist.mockResolvedValue(true);
  });

  it('rejects a contacts request from an untrusted origin before the lock check and keeps the queue usable', async () => {
    mockedRequestPermission.mockResolvedValue(permissionRes);

    await expect(processDApp('https://evil.example', { type: 'CONTACTS_CAPABILITY_REQUEST' })).rejects.toThrow(
      MavrykWalletDAppErrorType.NotGranted
    );
    await expect(processDApp(otherOrigin, permissionReq)).resolves.toBe(permissionRes);

    expect(mockedRequestPermission).toHaveBeenCalledWith(otherOrigin, permissionReq);
  });

  it('caps pending dApp requests per origin across permission, operation and sign requests', async () => {
    const first = createDeferred<any>();
    mockedRequestPermission.mockReturnValueOnce(first.promise).mockResolvedValue(permissionRes);
    mockedRequestOperation.mockResolvedValue({ type: MavrykWalletDAppMessageType.OperationResponse } as any);
    mockedRequestSign.mockResolvedValue({ type: MavrykWalletDAppMessageType.SignResponse } as any);

    const queued = [
      processDApp(dAppOrigin, permissionReq),
      processDApp(dAppOrigin, operationReq),
      processDApp(dAppOrigin, signReq)
    ];
    const overflow = processDApp(dAppOrigin, permissionReq);

    // Over-cap is a retryable "busy" signal, distinct from the NOT_GRANTED a user rejection gives.
    await expect(overflow).rejects.toThrow(DAPP_TOO_MANY_PENDING_REQUESTS_ERROR);
    await expect(overflow).rejects.not.toThrow(MavrykWalletDAppErrorType.NotGranted);

    const otherOriginReq = processDApp(otherOrigin, permissionReq);

    first.resolve(permissionRes);
    await expect(Promise.all(queued)).resolves.toHaveLength(3);
    await expect(otherOriginReq).resolves.toBe(permissionRes);

    expect(mockedRequestPermission).toHaveBeenCalledTimes(2);
    expect(mockedRequestOperation).toHaveBeenCalledTimes(1);
    expect(mockedRequestSign).toHaveBeenCalledTimes(1);

    await expect(processDApp(dAppOrigin, permissionReq)).resolves.toBe(permissionRes);
  });

  it('answers an over-cap Beacon request with a retryable error instead of NOT_GRANTED', async () => {
    const first = createDeferred<any>();
    mockedRequestPermission.mockReturnValueOnce(first.promise).mockResolvedValue(permissionRes);
    mockedDecodeMessage.mockReturnValueOnce({
      type: Beacon.MessageType.PermissionRequest,
      version: '2',
      id: 'beacon-request-id',
      beaconId: 'dapp-beacon-id',
      network: { type: 'mainnet' },
      appMetadata: { name: 'dApp', senderId: 'dapp-sender' },
      scopes: []
    } as any);

    const queued = [0, 1, 2].map(() => processDApp(dAppOrigin, permissionReq));
    const res = await processBeacon(dAppOrigin, 'beacon-message');

    expect(jest.requireActual('lib/temple/beacon').decodeMessage(res?.payload)).toMatchObject({
      type: Beacon.MessageType.Error,
      errorType: Beacon.ErrorType.UNKNOWN_ERROR,
      errorData: DAPP_TOO_MANY_PENDING_REQUESTS_ERROR
    });

    first.resolve(permissionRes);
    await expect(Promise.all(queued)).resolves.toHaveLength(3);
    expect(mockedRequestPermission).toHaveBeenCalledTimes(3);
  });

  describe('relay port lifecycle', () => {
    const connectedPorts = new Set<Runtime.Port>();
    let isConnectedSpy: jest.SpyInstance;

    const connectRelayPort = () => {
      const port = {} as Runtime.Port;
      connectedPorts.add(port);
      return port;
    };

    beforeEach(() => {
      connectedPorts.clear();
      isConnectedSpy = jest.spyOn(intercom, 'isConnected').mockImplementation(port => connectedPorts.has(port));
    });

    afterEach(() => {
      isConnectedSpy.mockRestore();
    });

    it('drops queued requests whose relay port disconnected before they are dequeued', async () => {
      const first = createDeferred<any>();
      mockedRequestPermission.mockReturnValueOnce(first.promise).mockResolvedValue(permissionRes);
      const activePort = connectRelayPort();
      const closedTabPort = connectRelayPort();

      const firstReq = processDApp(otherOrigin, permissionReq, activePort);
      const queued = [
        processDApp(dAppOrigin, permissionReq, closedTabPort),
        processDApp(dAppOrigin, operationReq, closedTabPort),
        processDApp(dAppOrigin, signReq, closedTabPort)
      ];
      await flushPromises();

      connectedPorts.delete(closedTabPort);
      first.resolve(permissionRes);

      await expect(firstReq).resolves.toBe(permissionRes);
      for (const req of queued) {
        await expect(req).rejects.toThrow(MavrykWalletDAppErrorType.NotGranted);
      }
      expect(mockedRequestPermission).toHaveBeenCalledTimes(1);
      expect(mockedRequestOperation).not.toHaveBeenCalled();
      expect(mockedRequestSign).not.toHaveBeenCalled();
    });

    it('does not let a page rotating origins leave queued requests behind after it navigates away', async () => {
      const first = createDeferred<any>();
      mockedRequestPermission.mockReturnValueOnce(first.promise).mockResolvedValue(permissionRes);
      const blockerPort = connectRelayPort();
      const blocker = processDApp(otherOrigin, permissionReq, blockerPort);

      const rotated: Promise<unknown>[] = [];
      for (const sub of ['a', 'b', 'c']) {
        // Every cross-origin navigation tears down the content script, so each origin arrives on a new port.
        const port = connectRelayPort();
        const origin = `https://${sub}.evil.example`;
        rotated.push(...[0, 1, 2].map(() => processDApp(origin, permissionReq, port)));
        await flushPromises();
        connectedPorts.delete(port);
      }

      first.resolve(permissionRes);

      await expect(blocker).resolves.toBe(permissionRes);
      const results = await Promise.allSettled(rotated);
      expect(results.every(r => r.status === 'rejected')).toBe(true);
      expect(mockedRequestPermission).toHaveBeenCalledTimes(1);
    });

    it('drops a queued Beacon request whose relay port disconnected and answers with a Beacon error', async () => {
      const first = createDeferred<any>();
      mockedRequestPermission.mockReturnValueOnce(first.promise).mockResolvedValue(permissionRes);
      const blockerPort = connectRelayPort();
      const beaconPort = connectRelayPort();
      mockedDecodeMessage.mockReturnValueOnce({
        type: Beacon.MessageType.PermissionRequest,
        version: '2',
        id: 'beacon-request-id',
        beaconId: 'dapp-beacon-id',
        network: { type: 'mainnet' },
        appMetadata: { name: 'dApp', senderId: 'dapp-sender' },
        scopes: []
      } as any);

      const blocker = processDApp(otherOrigin, permissionReq, blockerPort);
      const beaconRes = processBeacon(dAppOrigin, 'beacon-message', false, beaconPort);
      await flushPromises();

      connectedPorts.delete(beaconPort);
      first.resolve(permissionRes);

      await expect(blocker).resolves.toBe(permissionRes);
      const res = await beaconRes;
      expect(jest.requireActual('lib/temple/beacon').decodeMessage(res?.payload)).toMatchObject({
        type: Beacon.MessageType.Error,
        errorType: Beacon.ErrorType.NOT_GRANTED_ERROR
      });
      expect(mockedRequestPermission).toHaveBeenCalledTimes(1);
    });
  });

  it('rejects a queued request when dApps are disabled before it is dequeued', async () => {
    const first = createDeferred<any>();
    mockedRequestPermission.mockReturnValueOnce(first.promise).mockResolvedValue(permissionRes);

    const firstReq = processDApp(dAppOrigin, permissionReq);
    const queuedReq = processDApp(otherOrigin, permissionReq);
    await flushPromises();

    await browser.storage.local.set({ [TempleSharedStorageKey.DAppEnabled]: false });
    first.resolve(permissionRes);

    await expect(firstReq).resolves.toBe(permissionRes);
    await expect(queuedReq).rejects.toThrow(MavrykWalletDAppErrorType.NotGranted);
    expect(mockedRequestPermission).toHaveBeenCalledTimes(1);
  });
});
