import {
  buildAuthChallengeMessage,
  buildAuthChallengePayloadHex,
  buildLegacyAuthChallengePayloadHex,
  buildMavrykSignedMessage,
  buildMavrykSignedMessagePayloadHex,
  buildMichelineStringPayloadHex,
  getMichelinePayloadBytes,
  isAuthChallengeMessageOrHex,
  MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX,
  MAVRYK_SIGNED_MESSAGE_PREFIX,
  MICHELINE_WATERMARK
} from './auth-payload.helpers';

describe('auth payload helpers', () => {
  it('builds standard Micheline string payloads', () => {
    expect(buildMichelineStringPayloadHex('abc')).toBe('050100000003616263');
  });

  it('builds namespaced auth challenge messages for dApp filtering', () => {
    expect(buildAuthChallengeMessage('challenge')).toBe(`${MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX}: challenge`);
    expect(buildAuthChallengePayloadHex('challenge')).toBe(
      '0501000000274d617672796b2057616c6c65742041757468656e7469636174696f6e3a206368616c6c656e6765'
    );
  });

  it('builds verifier-compatible legacy auth challenge payloads', () => {
    expect(buildLegacyAuthChallengePayloadHex('challenge')).toBe('050100000012363336383631366336633635366536373635');
  });

  it('detects backend auth challenge text and the legacy hex-string variant', () => {
    const backendChallenge =
      'Mavryk Wallet Authentication\n\nPlease sign this message to authenticate.\n\nWallet Address: mv1-test';
    const backendChallengeHex = backendChallenge
      .split('')
      .map(char => char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');

    expect(isAuthChallengeMessageOrHex(backendChallenge)).toBe(true);
    expect(isAuthChallengeMessageOrHex(backendChallengeHex)).toBe(true);
  });

  it('builds Mavryk signed message payloads for Beacon RAW requests', () => {
    expect(buildMavrykSignedMessage('hello')).toBe(`${MAVRYK_SIGNED_MESSAGE_PREFIX}hello`);
    expect(buildMavrykSignedMessagePayloadHex('hello')).toBe(
      '05010000001c4d617672796b205369676e6564204d6573736167653a2068656c6c6f'
    );
  });

  it('splits Micheline watermark from bytes to preserve typed signing', () => {
    const payload = buildMichelineStringPayloadHex('abc');

    expect(getMichelinePayloadBytes(payload)).toBe(payload.slice(MICHELINE_WATERMARK.length));
  });
});
