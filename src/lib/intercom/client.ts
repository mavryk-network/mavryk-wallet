import browser, { Runtime } from 'webextension-polyfill';

import { deserealizeError } from './helpers';
import { MessageType, RequestMessage } from './types';

export const DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS = 30_000;

export type IntercomRequestOptions = {
  timeoutMs?: number;
};

type InFlightRequest = {
  port: Runtime.Port;
  listener: (msg: any) => void;
  timeout: ReturnType<typeof setTimeout>;
  reject: (error: Error) => void;
};

export class IntercomTimeoutError extends Error {
  name = 'IntercomTimeoutError';

  constructor(timeoutMs: number) {
    super(`Intercom request timed out after ${timeoutMs}ms`);
    Object.setPrototypeOf(this, IntercomTimeoutError.prototype);
  }
}

export class IntercomDisconnectedError extends Error {
  name = 'IntercomDisconnectedError';

  constructor() {
    super('Intercom disconnected');
    Object.setPrototypeOf(this, IntercomDisconnectedError.prototype);
  }
}

export class IntercomClient {
  private port: Runtime.Port;
  private reqId: number;
  private subscribers: ((data: any) => void)[] = [];
  private inFlightRequests = new Map<number, InFlightRequest>();

  constructor() {
    this.port = this.buildPort();
    this.reqId = 0;
  }

  /**
   * Makes a request to background process and returns a response promise
   */
  async request(
    payload: any,
    { timeoutMs = DEFAULT_INTERCOM_REQUEST_TIMEOUT_MS }: IntercomRequestOptions = {}
  ): Promise<any> {
    const reqId = this.reqId++;
    const port = this.port;

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('Intercom request timeout must be a positive finite number');
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const inFlightRequests = this.inFlightRequests;
      const timeout = setTimeout(() => rejectRequest(new IntercomTimeoutError(timeoutMs)), timeoutMs);

      function cleanup() {
        if (settled) return;
        settled = true;

        clearTimeout(timeout);
        port.onMessage.removeListener(listener);
        inFlightRequests.delete(reqId);
      }

      function settle(handler: () => void) {
        cleanup();
        handler();
      }

      function listener(msg: any) {
        switch (true) {
          case msg?.reqId !== reqId:
            return;

          case msg?.type === MessageType.Res:
            settle(() => resolve(msg.data));
            break;

          case msg?.type === MessageType.Err:
            settle(() => reject(deserealizeError(msg.data)));
            break;
        }
      }

      function rejectRequest(error: Error) {
        settle(() => reject(error));
      }

      this.inFlightRequests.set(reqId, {
        port,
        listener,
        timeout,
        reject: rejectRequest
      });
      port.onMessage.addListener(listener);

      try {
        this.send(port, { type: MessageType.Req, data: payload, reqId });
      } catch (err: any) {
        rejectRequest(err);
      }
    });
  }

  /**
   * Allows to subscribe to notifications channel from background process
   */
  subscribe(callback: (data: any) => void) {
    this.subscribers.push(callback);

    return () => {
      const index = this.subscribers.findIndex(callback);
      if (index > -1) this.subscribers.splice(index, 1);
    };
  }

  destroy() {
    this.port.disconnect();
  }

  private send(port: Runtime.Port, msg: RequestMessage) {
    port.postMessage(msg);
  }

  private onMessage(message: any) {
    if (message?.type !== MessageType.Sub) return;

    for (const subscriber of this.subscribers) {
      try {
        subscriber(message.data);
      } catch (error) {
        console.error(error);
      }
    }
  }

  private buildPort() {
    const port = browser.runtime.connect({ name: 'INTERCOM' });
    port.onMessage.addListener(this.onMessage.bind(this));
    port.onDisconnect.addListener(() => {
      this.rejectInFlightRequests(port, new IntercomDisconnectedError());
      this.port = this.buildPort();
    });

    return port;
  }

  private rejectInFlightRequests(port: Runtime.Port, error: IntercomDisconnectedError) {
    this.inFlightRequests.forEach(request => {
      if (request.port === port) {
        request.reject(error);
      }
    });
  }
}
