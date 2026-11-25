import { IntercomPortInfo, IntercomPortKind } from 'lib/intercom';
import { TempleMessageType, TempleRequest } from 'lib/temple/types';

const RELAY_ALLOWED_REQUEST_TYPES = new Set<TempleMessageType>([
  TempleMessageType.PageRequest,
  TempleMessageType.Acknowledge
]);

const getUrlOrigin = (url?: string) => {
  if (!url) return undefined;

  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
};

// The relayed `origin` is a claim in the message body; bind it to the browser-stamped port sender URL.
const isRelayOriginBoundToSender = (req: TempleRequest, senderUrl?: string) => {
  const origin: unknown = 'origin' in req ? req.origin : undefined;

  return typeof origin === 'string' && origin !== 'null' && getUrlOrigin(senderUrl) === origin;
};

export const isTempleRequestAllowedForPortInfo = (req: TempleRequest, portInfo: IntercomPortInfo) => {
  switch (portInfo.kind) {
    case IntercomPortKind.ContentScriptRelay:
      return (
        RELAY_ALLOWED_REQUEST_TYPES.has(req.type) &&
        portInfo.frameId === 0 &&
        isRelayOriginBoundToSender(req, portInfo.senderUrl)
      );

    case IntercomPortKind.ExtensionUi:
    case IntercomPortKind.ConfirmUi:
      return true;

    default:
      return false;
  }
};

export const assertTempleRequestAllowedForPortInfo = (req: TempleRequest, portInfo: IntercomPortInfo) => {
  if (!isTempleRequestAllowedForPortInfo(req, portInfo)) {
    throw new Error('Unauthorized intercom request source');
  }
};

export const assertExtensionUiPortInfo = (portInfo?: IntercomPortInfo) => {
  if (portInfo?.kind !== IntercomPortKind.ExtensionUi) {
    throw new Error('Unauthorized intercom UI source');
  }
};

export const assertConfirmUiPortInfo = (portInfo?: IntercomPortInfo) => {
  if (portInfo?.kind !== IntercomPortKind.ConfirmUi) {
    throw new Error('Unauthorized dApp confirmation source');
  }
};
