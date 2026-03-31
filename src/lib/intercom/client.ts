import browser, { Runtime } from 'webextension-polyfill';

import { deserealizeError } from './helpers';
import { MessageType, RequestMessage } from './types';

export class IntercomClient {
  private port: Runtime.Port;
  private reqId: number;
  private subscribers: ((data: any) => void)[] = [];

  constructor() {
    this.port = this.buildPort();
    this.reqId = 0;
  }

  /**
   * Makes a request to background process and returns a response promise
   */
  async request(payload: any): Promise<any> {
    const TIMEOUT_MS = 30_000;
    const reqId = this.reqId++;

    this.send({ type: MessageType.Req, data: payload, reqId });

    let listener: ((msg: any) => void) | null = null;

    const responsePromise = new Promise((resolve, reject) => {
      listener = (msg: any) => {
        switch (true) {
          case msg?.reqId !== reqId:
            return;

          case msg?.type === MessageType.Res:
            resolve(msg.data);
            break;

          case msg?.type === MessageType.Err:
            reject(deserealizeError(msg.data));
            break;
        }

        this.port.onMessage.removeListener(listener!);
        listener = null;
      };

      this.port.onMessage.addListener(listener);
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        if (listener) this.port.onMessage.removeListener(listener);
        reject(new Error('Intercom request timed out'));
      }, TIMEOUT_MS)
    );

    return Promise.race([responsePromise, timeoutPromise]);
  }

  /**
   * Allows to subscribe to notifications channel from background process
   */
  subscribe(callback: (data: any) => void) {
    this.subscribers.push(callback);

    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  destroy() {
    this.port.disconnect();
  }

  private send(msg: RequestMessage) {
    this.port.postMessage(msg);
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
      this.port = this.buildPort();
    });

    return port;
  }
}
