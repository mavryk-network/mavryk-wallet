import {
  buildAuthChallengeMessage,
  buildAuthChallengePayloadHex,
  buildLegacyAuthChallengePayloadHex,
  buildMavrykSignedMessage,
  buildMavrykSignedMessagePayloadHex,
  buildMichelineStringPayloadHex,
  buildStructuredAuthChallengeMessage,
  buildStructuredAuthChallengePayloadHex,
  getMichelinePayloadBytes,
  isAuthChallengeMessageOrHex,
  isStructuredAuthChallengeMessage,
  MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX,
  MAVRYK_SIGNED_MESSAGE_PREFIX,
  MICHELINE_WATERMARK,
  validateAuthChallengeForSigning
} from './auth-payload.helpers';
import { buildCurrentBackendAuthChallengeMessage } from './auth-test.helpers';

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

  it('builds and validates structured auth challenge messages', () => {
    const nowMs = Date.parse('2030-01-01T00:00:00.000Z');
    const expiresAt = '2030-01-01T00:05:00.000Z';
    const nonce = 'nonce-1234567890';
    const params = {
      walletAddress: 'mv1-auth-wallet',
      networkId: 'mainnet',
      nonce,
      expiresAt
    };
    const challenge = buildStructuredAuthChallengeMessage(params);

    expect(challenge).toBe(
      [
        'Mavryk Wallet Authentication',
        '',
        'Please sign this message to authenticate.',
        '',
        'Wallet Address: mv1-auth-wallet',
        'Network: mainnet',
        'Nonce: nonce-1234567890',
        'Expires At: 2030-01-01T00:05:00.000Z',
        'Audience: mavryk-wallet-api'
      ].join('\n')
    );
    expect(buildStructuredAuthChallengePayloadHex(params)).toBe(buildMichelineStringPayloadHex(challenge));
    expect(
      validateAuthChallengeForSigning(
        {
          challenge,
          nonce,
          expiresAt
        },
        {
          walletAddress: 'mv1-auth-wallet',
          networkId: 'mainnet'
        },
        nowMs
      )
    ).toEqual({ challenge, nonce, expiresAt });
  });

  it('rejects auth challenges that do not match the request context', () => {
    const nowMs = Date.parse('2030-01-01T00:00:00.000Z');
    const expiresAt = '2030-01-01T00:05:00.000Z';
    const nonce = 'nonce-1234567890';
    const challenge = buildStructuredAuthChallengeMessage({
      walletAddress: 'mv1-auth-wallet',
      networkId: 'mainnet',
      nonce,
      expiresAt
    });

    expect(() =>
      validateAuthChallengeForSigning(
        {
          challenge,
          nonce,
          expiresAt
        },
        {
          walletAddress: 'mv1-other-wallet',
          networkId: 'mainnet'
        },
        nowMs
      )
    ).toThrow('Auth challenge does not match the expected structured message');
  });

  it('validates current backend structured auth challenge messages', () => {
    const nowMs = Date.parse('2030-01-01T00:00:00.000Z');
    const challengeExpiresAt = '2030-01-01T00:05:00Z';
    const responseExpiresAt = '2030-01-01T00:05:00.123456789Z';
    const nonce = 'nonce-1234567890';
    const challenge = buildCurrentBackendAuthChallengeMessage({
      walletAddress: 'mv1-auth-wallet',
      nonce,
      timestamp: '2030-01-01T00:00:01Z',
      expiresAt: challengeExpiresAt
    });

    expect(isStructuredAuthChallengeMessage(challenge)).toBe(true);
    expect(
      validateAuthChallengeForSigning(
        {
          challenge,
          nonce,
          expiresAt: responseExpiresAt
        },
        {
          walletAddress: 'mv1-auth-wallet',
          networkId: 'mainnet'
        },
        nowMs
      )
    ).toEqual({ challenge, nonce, expiresAt: responseExpiresAt });
  });

  it('rejects current backend challenge messages with mismatched nonce', () => {
    const nowMs = Date.parse('2030-01-01T00:00:00.000Z');
    const challenge = buildCurrentBackendAuthChallengeMessage({
      walletAddress: 'mv1-auth-wallet',
      nonce: 'nonce-1234567890',
      timestamp: '2030-01-01T00:00:01Z',
      expiresAt: '2030-01-01T00:05:00Z'
    });

    expect(() =>
      validateAuthChallengeForSigning(
        {
          challenge,
          nonce: 'nonce-0987654321',
          expiresAt: '2030-01-01T00:05:00.000Z'
        },
        {
          walletAddress: 'mv1-auth-wallet',
          networkId: 'mainnet'
        },
        nowMs
      )
    ).toThrow('Auth challenge does not match the expected structured message');
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
