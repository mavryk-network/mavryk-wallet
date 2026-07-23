import {
  buildAuthChallengePayloadHex,
  buildLegacyAuthChallengePayloadHex,
  buildMavrykSignedMessagePayloadHex,
  buildMichelineStringPayloadHex,
  MICHELINE_WATERMARK
} from 'mavryk/api/auth-payload.helpers';

import { prepareDAppSignPayload } from './sign-payload.helpers';

describe('prepareDAppSignPayload', () => {
  const backendAuthChallenge =
    'Mavryk Wallet Authentication\n\nPlease sign this message to authenticate.\n\nWallet Address: mv1-test';
  const nexusOrigins = ['https://basenet.nexus.mavryk.org', 'https://nexus.mavryk.org'];

  it.each(['01abcdef', '02abcdef', '03abcdef'])('rejects forbidden payload prefix %s', payload => {
    expect(() => prepareDAppSignPayload(payload)).toThrow('must not be signed through sign_payload');
  });

  it('rejects unframed RAW payloads', () => {
    expect(() => prepareDAppSignPayload('68656c6c6f')).toThrow('Micheline-framed');
  });

  it('rejects invalid Micheline payloads without a displayable preview', () => {
    expect(() => prepareDAppSignPayload('05abcdef')).toThrow('displayable Micheline preview');
  });

  it('rejects wallet auth challenge payloads', () => {
    expect(() => prepareDAppSignPayload(buildAuthChallengePayloadHex('challenge'))).toThrow(
      'Auth challenge payloads cannot be signed by dApps'
    );
    expect(() => prepareDAppSignPayload(buildMichelineStringPayloadHex(backendAuthChallenge))).toThrow(
      'Auth challenge payloads cannot be signed by dApps'
    );
    expect(() => prepareDAppSignPayload(buildLegacyAuthChallengePayloadHex(backendAuthChallenge))).toThrow(
      'Auth challenge payloads cannot be signed by dApps'
    );
  });

  it('rejects wallet auth challenge payloads from untrusted origins', () => {
    expect(() =>
      prepareDAppSignPayload(buildMichelineStringPayloadHex(backendAuthChallenge), 'https://example.com')
    ).toThrow('Auth challenge payloads cannot be signed by dApps');
  });

  it.each(nexusOrigins)('allows wallet auth challenge payloads from trusted Nexus origin %s', origin => {
    const payload = buildMichelineStringPayloadHex(backendAuthChallenge);

    expect(prepareDAppSignPayload(payload, origin)).toEqual({
      payload,
      preview: backendAuthChallenge,
      bytesToSign: payload.slice(MICHELINE_WATERMARK.length),
      watermark: MICHELINE_WATERMARK
    });
  });

  it('rejects legacy Tezos signed message framing', () => {
    expect(() => prepareDAppSignPayload(buildMichelineStringPayloadHex('Tezos Signed Message: hello'))).toThrow(
      'Mavryk Signed Message framing'
    );
  });

  it('prepares Mavryk signed message payloads with an explicit Micheline watermark', () => {
    const payload = buildMavrykSignedMessagePayloadHex('hello');

    expect(prepareDAppSignPayload(payload)).toEqual({
      payload,
      preview: 'Mavryk Signed Message: hello',
      bytesToSign: payload.slice(MICHELINE_WATERMARK.length),
      watermark: MICHELINE_WATERMARK
    });
  });

  it('allows displayable Micheline payloads', () => {
    const payload = buildMichelineStringPayloadHex('hello');

    expect(prepareDAppSignPayload(`0x${payload}`)).toEqual({
      payload,
      preview: 'hello',
      bytesToSign: payload.slice(MICHELINE_WATERMARK.length),
      watermark: MICHELINE_WATERMARK
    });
  });
});
