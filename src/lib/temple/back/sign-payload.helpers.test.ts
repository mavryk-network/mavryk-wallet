import { num2PaddedHex } from '@mavrykdynamics/webmavryk-utils';

import {
  buildAuthChallengePayloadHex,
  buildLegacyAuthChallengePayloadHex,
  buildMavrykSignedMessagePayloadHex,
  buildMichelineStringPayloadHex,
  MICHELINE_WATERMARK,
  utf8ToHex
} from 'mavryk/api/auth-payload.helpers';

import { prepareDAppSignPayload } from './sign-payload.helpers';

const MICHELINE_BYTES_TAG = '0a';
const MICHELINE_SEQUENCE_TAG = '02';
const MICHELINE_PAIR_PRIM = '0707';

const lengthPrefixed = (hex: string) => `${num2PaddedHex(hex.length / 2, 32)}${hex}`;
const stringNode = (message: string) => `01${lengthPrefixed(utf8ToHex(message))}`;
const bytesNode = (message: string) => `${MICHELINE_BYTES_TAG}${lengthPrefixed(utf8ToHex(message))}`;
const sequenceNode = (...nodes: string[]) => `${MICHELINE_SEQUENCE_TAG}${lengthPrefixed(nodes.join(''))}`;
const pairNode = (left: string, right: string) => `${MICHELINE_PAIR_PRIM}${left}${right}`;

describe('prepareDAppSignPayload', () => {
  const backendAuthChallenge =
    'Mavryk Wallet Authentication\n\nPlease sign this message to authenticate.\n\nWallet Address: mv1-test';
  const trustedAuthChallengeOrigins = [
    'https://basenet.nexus.mavryk.org',
    'https://nexus.mavryk.org',
    'https://app.equiteez.com',
    'https://app.equiteez.com/path',
    'https://equiteez-app.pages.dev'
  ];

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

  it.each(trustedAuthChallengeOrigins)('allows wallet auth challenge payloads from trusted origin %s', origin => {
    const payload = buildMichelineStringPayloadHex(backendAuthChallenge);

    expect(prepareDAppSignPayload(payload, origin)).toEqual({
      payload,
      preview: backendAuthChallenge,
      bytesToSign: payload.slice(MICHELINE_WATERMARK.length),
      watermark: MICHELINE_WATERMARK
    });
  });

  it.each([
    'http://app.equiteez.com',
    'https://app.equiteez.com:444',
    'https://app.equiteez.com.evil.com',
    'https://preview.equiteez-app.pages.dev:444',
    'https://malicious-equiteez-app.pages.dev',
    'https://equiteez-app.pages.dev.evil.com',
    'https://mav-3957-auth-2-for-contacts.mavryk-nexus.pages.dev:444',
    'https://malicious-mavryk-nexus.pages.dev',
    'https://mavryk-nexus.pages.dev.evil.com',
    'https://localhost.evil.com',
    'http://127.0.0.2:3000',
    // Loopback and preview deployments are trusted in development builds only
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
    'https://preview.equiteez-app.pages.dev',
    'https://branch.preview.equiteez-app.pages.dev',
    'https://mav-3957-auth-2-for-contacts.mavryk-nexus.pages.dev/'
  ])('rejects wallet auth challenge payloads from untrusted near-match origin %s', origin => {
    expect(() => prepareDAppSignPayload(buildMichelineStringPayloadHex(backendAuthChallenge), origin)).toThrow(
      'Auth challenge payloads cannot be signed by dApps'
    );
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

  it('rejects payloads with trailing bytes after the previewed Micheline value', () => {
    expect(() => prepareDAppSignPayload(`${MICHELINE_WATERMARK}${stringNode('benign')}deadbeef`)).toThrow(
      'displayable Micheline preview'
    );
  });

  it('rejects payloads whose declared length overruns the available bytes', () => {
    expect(() => prepareDAppSignPayload(`${MICHELINE_WATERMARK}0100000010${utf8ToHex('short')}`)).toThrow(
      'displayable Micheline preview'
    );
  });

  it('rejects wallet auth challenges framed as a Micheline bytes literal', () => {
    expect(() =>
      prepareDAppSignPayload(`${MICHELINE_WATERMARK}${bytesNode(backendAuthChallenge)}`, 'https://example.com')
    ).toThrow('Auth challenge payloads cannot be signed by dApps');
  });

  it('rejects wallet auth challenges wrapped in a Micheline sequence', () => {
    expect(() =>
      prepareDAppSignPayload(
        `${MICHELINE_WATERMARK}${sequenceNode(stringNode(backendAuthChallenge))}`,
        'https://example.com'
      )
    ).toThrow('Auth challenge payloads cannot be signed by dApps');
  });

  it('rejects wallet auth challenges nested inside a Pair', () => {
    expect(() =>
      prepareDAppSignPayload(
        `${MICHELINE_WATERMARK}${pairNode(stringNode('hello'), bytesNode(backendAuthChallenge))}`,
        'https://example.com'
      )
    ).toThrow('Auth challenge payloads cannot be signed by dApps');
  });

  it('rejects legacy Tezos signed message framing nested in a bytes literal', () => {
    expect(() =>
      prepareDAppSignPayload(`${MICHELINE_WATERMARK}${sequenceNode(bytesNode('Tezos Signed Message: hello'))}`)
    ).toThrow('Mavryk Signed Message framing');
  });

  it('allows wallet auth challenges wrapped in a sequence from a trusted origin', () => {
    const payload = `${MICHELINE_WATERMARK}${sequenceNode(stringNode(backendAuthChallenge))}`;

    expect(prepareDAppSignPayload(payload, 'https://nexus.mavryk.org').bytesToSign).toBe(
      payload.slice(MICHELINE_WATERMARK.length)
    );
  });

  it('allows displayable Pair payloads', () => {
    const payload = `${MICHELINE_WATERMARK}${pairNode(stringNode('hello'), '0001')}`;

    expect(prepareDAppSignPayload(payload)).toEqual({
      payload,
      preview: 'Pair "hello" 1',
      bytesToSign: payload.slice(MICHELINE_WATERMARK.length),
      watermark: MICHELINE_WATERMARK
    });
  });
});
