import { IntercomPortKind, type IntercomPortInfo } from 'lib/intercom';
import { TempleMessageType, type TempleRequest } from 'lib/temple/types';

import { isTempleRequestAllowedForPortInfo } from './intercom-permissions';

const DAPP_ORIGIN = 'https://a.example';

const request = (type: TempleMessageType, origin: unknown = DAPP_ORIGIN) => ({ type, origin } as TempleRequest);

describe('intercom Temple request permissions', () => {
  it('allows content-script relay ports to send only top-frame dApp relay requests', () => {
    const relayPortInfo: IntercomPortInfo = {
      kind: IntercomPortKind.ContentScriptRelay,
      senderUrl: `${DAPP_ORIGIN}/page`,
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
      senderUrl: `${DAPP_ORIGIN}/page`,
      frameId: 2
    };

    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), iframeRelayPortInfo)).toBe(false);
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.Acknowledge), iframeRelayPortInfo)).toBe(false);
  });

  it('rejects relay requests when the frame id is missing', () => {
    const relayPortInfo: IntercomPortInfo = {
      kind: IntercomPortKind.ContentScriptRelay,
      senderUrl: `${DAPP_ORIGIN}/page`
    };

    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), relayPortInfo)).toBe(false);
    expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.Acknowledge), relayPortInfo)).toBe(false);
  });

  describe('relay origin binding', () => {
    const relayPortInfo: IntercomPortInfo = {
      kind: IntercomPortKind.ContentScriptRelay,
      senderUrl: 'https://a.example/page?query=1#hash',
      frameId: 0
    };

    it('rejects relay requests whose claimed origin differs from the port sender origin', () => {
      expect(
        isTempleRequestAllowedForPortInfo(
          request(TempleMessageType.PageRequest, 'https://nexus.mavryk.org'),
          relayPortInfo
        )
      ).toBe(false);
      expect(
        isTempleRequestAllowedForPortInfo(
          request(TempleMessageType.Acknowledge, 'https://nexus.mavryk.org'),
          relayPortInfo
        )
      ).toBe(false);
    });

    it('allows relay requests whose claimed origin matches the port sender origin', () => {
      expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), relayPortInfo)).toBe(true);
      expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.Acknowledge), relayPortInfo)).toBe(true);
    });

    it('compares normalised origins of the sender URL', () => {
      const portInfo: IntercomPortInfo = {
        kind: IntercomPortKind.ContentScriptRelay,
        senderUrl: 'https://A.Example:443/page',
        frameId: 0
      };

      expect(isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), portInfo)).toBe(true);
      expect(
        isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest, 'https://a.example:8443'), portInfo)
      ).toBe(false);
    });

    it('rejects relay requests when the sender URL is missing or unparseable', () => {
      expect(
        isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), {
          kind: IntercomPortKind.ContentScriptRelay,
          frameId: 0
        })
      ).toBe(false);
      expect(
        isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest), {
          kind: IntercomPortKind.ContentScriptRelay,
          senderUrl: 'not a url',
          frameId: 0
        })
      ).toBe(false);
    });

    it('rejects relay requests with a missing, non-string or opaque origin', () => {
      expect(
        isTempleRequestAllowedForPortInfo({ type: TempleMessageType.PageRequest } as TempleRequest, relayPortInfo)
      ).toBe(false);
      expect(
        isTempleRequestAllowedForPortInfo(
          request(TempleMessageType.PageRequest, { toString: () => 'https://a.example' }),
          relayPortInfo
        )
      ).toBe(false);
      expect(
        isTempleRequestAllowedForPortInfo(request(TempleMessageType.PageRequest, 'null'), {
          kind: IntercomPortKind.ContentScriptRelay,
          senderUrl: 'data:text/html,hello',
          frameId: 0
        })
      ).toBe(false);
    });
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
