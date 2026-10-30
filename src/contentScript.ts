import { MavrykWalletPageMessage, MavrykWalletPageMessageType } from '@mavrykdynamics/mavryk-wallet-dapp/dist/types';

import { PUBLIC_EXTENSION_ID } from 'lib/extension-id';
import { serealizeError } from 'lib/intercom/helpers';
import { getTempleRequestTimeoutMs } from 'lib/temple/request-timeouts';
import { TempleMessageType, TempleResponse } from 'lib/temple/types';

import { isProcessablePageMessage } from './content-scripts/page-message.helpers';
import { getIntercom } from './intercom-client';

enum BeaconMessageTarget {
  Page = 'toPage',
  Extension = 'toExtension'
}

enum LegacyPageMessageType {
  Request = 'THANOS_PAGE_REQUEST',
  Response = 'THANOS_PAGE_RESPONSE',
  ErrorResponse = 'THANOS_PAGE_ERROR_RESPONSE'
}

interface LegacyPageMessage {
  type: LegacyPageMessageType;
  payload: any;
  reqId?: string | number;
}

type BeaconMessage =
  | {
      target: BeaconMessageTarget;
      payload: any;
    }
  | {
      target: BeaconMessageTarget;
      encryptedPayload: any;
    };
type BeaconPageMessage = BeaconMessage | { message: BeaconMessage; sender: { id: string } };

const isTopFrame = () => window.top === window;

const SENDER = {
  id: PUBLIC_EXTENSION_ID,
  name: 'Mavryk Wallet',
  iconUrl: 'https://mavryk.org/logo.png'
};

if (isTopFrame()) {
  window.addEventListener(
    'message',
    evt => {
      if (!isProcessablePageMessage(evt, window)) return;

      const legacyRequest = evt.data?.type === LegacyPageMessageType.Request;
      const isTempleRequest = evt.data?.type === MavrykWalletPageMessageType.Request || legacyRequest;
      const isBeaconRequest =
        evt.data?.target === BeaconMessageTarget.Extension && (evt.data?.targetId === SENDER.id || !evt.data?.targetId);

      if (isTempleRequest) {
        templeRequest(evt, legacyRequest);
      } else if (isBeaconRequest) {
        beaconRequest(evt);
      } else {
        return;
      }
    },
    false
  );
}

function templeRequest(evt: MessageEvent, isLegacyRequest: boolean) {
  const { payload, reqId } = evt.data as MavrykWalletPageMessage;

  getIntercom()
    .request(
      {
        type: TempleMessageType.PageRequest,
        origin: evt.origin,
        payload
      },
      {
        timeoutMs: getTempleRequestTimeoutMs(TempleMessageType.PageRequest)
      }
    )
    .then((res: TempleResponse) => {
      if (res?.type === TempleMessageType.PageResponse) {
        send(
          {
            type: isLegacyRequest ? LegacyPageMessageType.Response : MavrykWalletPageMessageType.Response,
            payload: res.payload,
            reqId
          },
          evt.origin
        );
      }
    })
    .catch(err => {
      send(
        {
          type: isLegacyRequest ? LegacyPageMessageType.ErrorResponse : MavrykWalletPageMessageType.ErrorResponse,
          payload: serealizeError(err),
          reqId
        },
        evt.origin
      );
    });
}

function beaconRequest(evt: MessageEvent) {
  const { origin, data } = evt;
  const encrypted = Boolean(data.encryptedPayload);
  getIntercom()
    .request(
      {
        type: TempleMessageType.PageRequest,
        origin: origin,
        payload: data.encryptedPayload ?? data.payload,
        beacon: true,
        encrypted: Boolean(data.encryptedPayload)
      },
      {
        timeoutMs: getTempleRequestTimeoutMs(TempleMessageType.PageRequest)
      }
    )
    .then((res: TempleResponse) => {
      if (res?.type === TempleMessageType.PageResponse && res.payload) {
        const message = {
          target: BeaconMessageTarget.Page,
          ...(res.encrypted ? { encryptedPayload: res.payload } : { payload: res.payload })
        };
        send(
          res.payload === 'pong'
            ? { ...message, sender: SENDER }
            : {
                message,
                sender: { id: SENDER.id }
              },
          origin
        );
      }
    })
    .catch(err => console.error(err));

  getIntercom()
    .request({
      type: TempleMessageType.Acknowledge,
      origin: origin,
      payload: data.encryptedPayload ?? data.payload,
      beacon: true,
      encrypted: encrypted
    })
    .then((res: TempleResponse) => {
      if (res?.type === TempleMessageType.Acknowledge) {
        const acknowledgeMessage = {
          target: BeaconMessageTarget.Page,
          ...(res.encrypted ? { encryptedPayload: res.payload } : { payload: res.payload })
        };
        send(
          {
            message: acknowledgeMessage,
            sender: { id: SENDER.id }
          },
          origin
        );
      }
    })
    .catch(err => console.error(err));
}

function send(msg: MavrykWalletPageMessage | LegacyPageMessage | BeaconPageMessage, targetOrigin: string) {
  if (!targetOrigin || targetOrigin === '*') return;
  window.postMessage(msg, targetOrigin);
}
