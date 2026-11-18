import browser from 'webextension-polyfill';

import {
  DAPP_CONFIRMATION_AUTODECLINE_MS,
  IN_WALLET_CONFIRMATION_AUTODECLINE_MS
} from 'lib/temple/confirmation-timeouts';
import { getTempleRequestTimeoutMs } from 'lib/temple/request-timeouts';
import { TempleMessageType } from 'lib/temple/types';

import {
  DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS,
  IntercomClient,
  IntercomDisconnectedError,
  IntercomTimeoutError
} from './client';
import { MessageType } from './types';

type Listener<T extends unknown[] = any[]> = (...args: T) => void;

type MockEvent<T extends unknown[]> = {
  addListener: jest.Mock<void, [listener: Listener<T>]>;
  removeListener: jest.Mock<void, [listener: Listener<T>]>;
  emit: (...args: T) => void;
  listenerCount: () => number;
};

const createEvent = <T extends unknown[]>(): MockEvent<T> => {
  const listeners: Array<Listener<T>> = [];

  return {
    addListener: jest.fn((listener: Listener<T>) => {
      listeners.push(listener);
    }),
    removeListener: jest.fn((listener: Listener<T>) => {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }),
    emit: (...args: T) => {
      listeners.slice().forEach(listener => listener(...args));
    },
    listenerCount: () => listeners.length
  };
};

type MockPort = {
  name: string;
  postMessage: jest.Mock;
  disconnect: jest.Mock;
  onMessage: MockEvent<[unknown]>;
  onDisconnect: MockEvent<[]>;
};

const createPort = (): MockPort => ({
  name: 'INTERCOM',
  postMessage: jest.fn(),
  disconnect: jest.fn(),
  onMessage: createEvent<[unknown]>(),
  onDisconnect: createEvent<[]>()
});

describe('IntercomClient', () => {
  let ports: MockPort[];
  let connectMock: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    ports = [];

    connectMock = jest.spyOn(browser.runtime, 'connect').mockImplementation(() => {
      const port = createPort();
      ports.push(port);

      return port as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('rejects unclassified requests after the default timeout', async () => {
    const client = new IntercomClient();
    const promise = client.request({ value: 'default' });
    const assertion = expect(promise).rejects.toBeInstanceOf(IntercomTimeoutError);

    jest.advanceTimersByTime(DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS);

    await assertion;
    expect(ports[0].onMessage.listenerCount()).toBe(1);
  });

  it('uses an allowlisted long timeout when one is passed', async () => {
    const client = new IntercomClient();
    const timeoutMs = getTempleRequestTimeoutMs(TempleMessageType.OperationsRequest);
    const promise = client.request({ type: TempleMessageType.OperationsRequest }, { timeoutMs });
    const assertion = expect(promise).rejects.toBeInstanceOf(IntercomTimeoutError);
    let hasRejected = false;
    promise.catch(() => {
      hasRejected = true;
    });

    jest.advanceTimersByTime(timeoutMs - 1);
    await Promise.resolve();

    expect(hasRejected).toBe(false);

    jest.advanceTimersByTime(1);

    await assertion;
    expect(hasRejected).toBe(true);
  });

  it.each([
    [TempleMessageType.OperationsRequest, IN_WALLET_CONFIRMATION_AUTODECLINE_MS, TempleMessageType.ConfirmationRequest],
    [TempleMessageType.SignRequest, IN_WALLET_CONFIRMATION_AUTODECLINE_MS, TempleMessageType.ConfirmationRequest],
    [TempleMessageType.PageRequest, DAPP_CONFIRMATION_AUTODECLINE_MS, TempleMessageType.DAppOpsConfirmationRequest]
  ])(
    'delivers the %s result when the decision lands just before auto-decline and finishes after the grace window',
    async (outerType, autodeclineMs, decisionType) => {
      const client = new IntercomClient();
      const promise = client.request({ type: outerType }, { timeoutMs: getTempleRequestTimeoutMs(outerType) });
      const sentMessage = ports[0].postMessage.mock.calls[0][0];
      let outcome: unknown;
      promise.then(
        res => (outcome = res),
        err => (outcome = err)
      );

      // Confirmed at deadline - 1; the vault then uses its whole decision budget (e.g. slow Ledger review).
      jest.advanceTimersByTime(autodeclineMs - 1 + getTempleRequestTimeoutMs(decisionType) - 1);
      await Promise.resolve();
      expect(outcome).toBeUndefined();

      ports[0].onMessage.emit({ type: MessageType.Res, reqId: sentMessage.reqId, data: { opHash: 'oo1' } });

      await expect(promise).resolves.toEqual({ opHash: 'oo1' });
    }
  );

  it('clears timeout and request listener when a response settles the request', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const client = new IntercomClient();
    const promise = client.request({ value: 'response' });
    const sentMessage = ports[0].postMessage.mock.calls[0][0];

    ports[0].onMessage.emit({
      type: MessageType.Res,
      reqId: sentMessage.reqId,
      data: { ok: true }
    });

    await expect(promise).resolves.toEqual({ ok: true });
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(ports[0].onMessage.listenerCount()).toBe(1);
  });

  it('rejects in-flight requests with IntercomDisconnectedError before rebuilding the port', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const client = new IntercomClient();
    const firstPort = ports[0];
    const firstRequest = client.request({ value: 'first' });
    const secondRequest = client.request({ value: 'second' });
    const assertion = Promise.all([
      expect(firstRequest).rejects.toBeInstanceOf(IntercomDisconnectedError),
      expect(secondRequest).rejects.toBeInstanceOf(IntercomDisconnectedError)
    ]);

    firstPort.onDisconnect.emit();

    await assertion;
    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(firstPort.onMessage.listenerCount()).toBe(1);
  });
});
