import { IntercomPortKind, type IntercomPortInfo } from 'lib/intercom';
import { TempleMessageType, type TempleRequest } from 'lib/temple/types';

import { isTempleRequestAllowedForPortInfo } from './intercom-permissions';

const request = (type: TempleMessageType) => ({ type } as TempleRequest);

describe('intercom Temple request permissions', () => {
  it('allows content-script relay ports to send only top-frame dApp relay requests', () => {
    const relayPortInfo: IntercomPortInfo = {
      kind: IntercomPortKind.ContentScriptRelay,
      frameId: 0
    };

    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), relayPortInfo)).toBe(true);
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.Acknowledge), relayPortInfo)).toBe(true);
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.SignRequest), relayPortInfo)).toBe(false);
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.OperationsRequest), relayPortInfo)).toBe(false);
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.ConfirmationRequest), relayPortInfo)).toBe(
      false
    );
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.UnlockRequest), relayPortInfo)).toBe(false);
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.RevealPrivateKeyRequest), relayPortInfo)).toBe(
      false
    );
  });

  it('rejects relay requests from known iframe ports', () => {
    const iframeRelayPortInfo: IntercomPortInfo = {
      kind: IntercomPortKind.ContentScriptRelay,
      frameId: 2
    };

    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), iframeRelayPortInfo)).toBe(false);
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.Acknowledge), iframeRelayPortInfo)).toBe(false);
  });

  it('rejects relay requests when the frame id is missing', () => {
    const relayPortInfo: IntercomPortInfo = {
      kind: IntercomPortKind.ContentScriptRelay
    };

    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), relayPortInfo)).toBe(false);
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.Acknowledge), relayPortInfo)).toBe(false);
  });

  it('allows trusted UI ports and rejects unknown ports', () => {
    expect(
      isTempleRequestAllowedForPortInfo(request(TempleMessageType.SignRequest), {
        kind: IntercomPortKind.ExtensionUi
      })
    ).toBe(true);
    expect(
      isTempleRequestAllowedForPortInfo(request(TempleMessageType.DAppGetPayloadRequest), {
        kind: IntercomPortKind.ConfirmUi
      })
    ).toBe(true);
    expect(
      isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), {
        kind: IntercomPortKind.Unknown
      })
    ).toBe(false);
  });
});
