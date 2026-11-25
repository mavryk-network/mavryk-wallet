import browser, { Runtime } from 'webextension-polyfill';

import { serealizeError } from './helpers';
import { MessageType, RequestMessage, ResponseMessage, ErrorMessage, SubscriptionMessage } from './types';

export enum IntercomPortKind {
  ExtensionUi = 'extension-ui',
  ConfirmUi = 'confirm-ui',
  ContentScriptRelay = 'content-script-relay',
  Unknown = 'unknown'
}

export interface IntercomPortInfo {
  kind: IntercomPortKind;
  senderUrl?: string;
  tabId?: number;
  frameId?: number;
}

type ReqHandler = (payload: any, port: Runtime.Port, portInfo: IntercomPortInfo) => Promise<any>;

export const isExtensionUiPortInfo = (portInfo?: IntercomPortInfo) => portInfo?.kind === IntercomPortKind.ExtensionUi;

export const isConfirmUiPortInfo = (portInfo?: IntercomPortInfo) => portInfo?.kind === IntercomPortKind.ConfirmUi;

export const isTrustedUiPortInfo = (portInfo?: IntercomPortInfo) =>
  isExtensionUiPortInfo(portInfo) || isConfirmUiPortInfo(portInfo);

export const classifyIntercomPort = (port: Runtime.Port): IntercomPortInfo => {
  const sender = port.sender;
  const senderUrl = sender?.url;

  const baseInfo = {
    senderUrl,
    tabId: sender?.tab?.id,
    frameId: sender?.frameId
  };

  if (sender?.id !== browser.runtime.id) {
    return {
      ...baseInfo,
      kind: IntercomPortKind.Unknown
    };
  }

  const extensionOrigin = getExtensionOrigin();
  const senderUrlInfo = parseUrl(senderUrl);

  if (extensionOrigin && senderUrlInfo?.origin === extensionOrigin) {
    return {
      ...baseInfo,
      kind: senderUrlInfo.pathname.endsWith('/confirm.html') ? IntercomPortKind.ConfirmUi : IntercomPortKind.ExtensionUi
    };
  }

  if (sender.tab) {
    return {
      ...baseInfo,
      kind: IntercomPortKind.ContentScriptRelay
    };
  }

  return {
    ...baseInfo,
    kind: IntercomPortKind.Unknown
  };
};

const getExtensionOrigin = () => parseUrl(browser.runtime.getURL('/'))?.origin;

const parseUrl = (url?: string) => {
  if (!url) return undefined;

  try {
    return new URL(url);
  } catch {
    return undefined;
  }
};

export class IntercomServer {
  private ports = new Map<Runtime.Port, IntercomPortInfo>();
  private reqHandlers: Array<ReqHandler> = [];

  constructor() {
    browser.runtime.onConnect.addListener(port => {
      if (port.name !== 'INTERCOM') return;

      this.addPort(port);

      port.onDisconnect.addListener(() => {
        this.removePort(port);
      });
    });

    this.handleMessage = this.handleMessage.bind(this);
  }

  isConnected(port: Runtime.Port) {
    return this.ports.has(port);
  }

  getPortInfo(port: Runtime.Port) {
    return this.ports.get(port);
  }

  onRequest(handler: ReqHandler) {
    this.addReqHandler(handler);
    return () => {
      this.removeReqHandler(handler);
    };
  }

  broadcast(data: any) {
    const msg: SubscriptionMessage = { type: MessageType.Sub, data };
    this.ports.forEach((_portInfo, port) => {
      port.postMessage(msg);
    });
  }

  notify(port: Runtime.Port, data: any) {
    this.send(port, { type: MessageType.Sub, data });
  }

  onDisconnect(port: Runtime.Port, listener: () => void) {
    port.onDisconnect.addListener(listener);
    return () => port.onDisconnect.removeListener(listener);
  }

  private handleMessage(msg: any, port: Runtime.Port) {
    const portInfo = this.ports.get(port);

    if (portInfo && msg?.type === MessageType.Req) {
      (async msgInner => {
        try {
          for (const handler of this.reqHandlers) {
            const data = await handler(msg.data, port, portInfo);
            if (data !== undefined) {
              this.send(port, {
                type: MessageType.Res,
                reqId: msgInner.reqId,
                data
              });

              return;
            }
          }

          throw new Error('Not Found');
        } catch (err: any) {
          this.send(port, {
            type: MessageType.Err,
            reqId: msgInner.reqId,
            data: serealizeError(err)
          });
        }
      })(msg as RequestMessage);
    }
  }

  private send(port: Runtime.Port, msg: ResponseMessage | SubscriptionMessage | ErrorMessage) {
    if (this.ports.has(port)) {
      port.postMessage(msg);
    }
  }

  private addPort(port: Runtime.Port) {
    const portInfo = classifyIntercomPort(port);

    if (portInfo.kind === IntercomPortKind.Unknown && port.sender?.id !== browser.runtime.id) return;

    port.onMessage.addListener(this.handleMessage);
    this.ports.set(port, portInfo);
  }

  private removePort(port: Runtime.Port) {
    port.onMessage.removeListener(this.handleMessage);
    this.ports.delete(port);
  }

  private addReqHandler(handler: ReqHandler) {
    this.reqHandlers.unshift(handler);
  }

  private removeReqHandler(handler: ReqHandler) {
    this.reqHandlers = this.reqHandlers.filter(h => h !== handler);
  }
}
