import { IntercomPortInfo, IntercomPortKind } from 'lib/intercom';
import { TempleMessageType, TempleRequest } from 'lib/temple/types';

const RELAY_ALLOWED_REQUEST_TYPES = new Set<TempleMessageType>([
  TempleMessageType.PageRequest,
  TempleMessageType.Acknowledge
]);

export const isTempleRequestAllowedForPortInfo = (req: TempleRequest, portInfo: IntercomPortInfo) => {
  switch (portInfo.kind) {
    case IntercomPortKind.ContentScriptRelay:
      return RELAY_ALLOWED_REQUEST_TYPES.has(req.type) && portInfo.frameId === 0;

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
