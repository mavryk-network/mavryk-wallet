import { valueDecoder } from '@mavrykdynamics/webmavryk-local-forging/dist/lib/michelson/codec';
import { Uint8ArrayConsumer } from '@mavrykdynamics/webmavryk-local-forging/dist/lib/uint8array-consumer';
import { emitMicheline } from '@mavrykdynamics/webmavryk-michel-codec';

import {
  getMichelinePayloadBytes,
  isAuthChallengeMessageOrHex,
  MICHELINE_WATERMARK
} from 'mavryk/api/auth-payload.helpers';

const HEX_BYTES_PATTERN = /^(?:[0-9a-fA-F]{2})+$/;
const FORBIDDEN_SIGN_PAYLOAD_PREFIXES = new Set(['01', '02', '03']);
const TEZOS_SIGNED_MESSAGE_PREFIX = 'Tezos Signed Message: ';
const TRUSTED_AUTH_CHALLENGE_SIGNER_HOSTS = new Set([
  'basenet.nexus.mavryk.org',
  'nexus.mavryk.org',
  'app.equiteez.com',
  'equiteez-app.pages.dev'
]);
const TRUSTED_AUTH_CHALLENGE_SIGNER_HOST_SUFFIXES = ['.equiteez-app.pages.dev', '.mavryk-nexus.pages.dev'];
const LOCAL_AUTH_CHALLENGE_SIGNER_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

type MichelinePreview = {
  preview: string;
  decodedString?: string;
};

export type PreparedDAppSignPayload = {
  payload: string;
  preview: string;
  bytesToSign: string;
  watermark: string;
};

export function stripHexPrefix(payload: string) {
  return payload.startsWith('0x') || payload.startsWith('0X') ? payload.slice(2) : payload;
}

export function prepareDAppSignPayload(payload: string, origin?: string): PreparedDAppSignPayload {
  const normalizedPayload = stripHexPrefix(payload);

  if (!HEX_BYTES_PATTERN.test(normalizedPayload)) {
    throw new Error('Sign payload must be non-empty even-length hex');
  }

  const payloadPrefix = normalizedPayload.slice(0, 2).toLowerCase();

  if (FORBIDDEN_SIGN_PAYLOAD_PREFIXES.has(payloadPrefix)) {
    throw new Error('Operation, block, and endorsement payloads must not be signed through sign_payload');
  }

  if (payloadPrefix !== MICHELINE_WATERMARK) {
    throw new Error('Sign payload must be Micheline-framed');
  }

  const michelinePreview = getMichelinePreview(normalizedPayload);

  if (!michelinePreview) {
    throw new Error('Sign payload must have a displayable Micheline preview');
  }

  if (
    michelinePreview.decodedString &&
    isAuthChallengeMessageOrHex(michelinePreview.decodedString) &&
    !isTrustedAuthChallengeSignerOrigin(origin)
  ) {
    throw new Error('Auth challenge payloads cannot be signed by dApps');
  }

  if (michelinePreview.decodedString?.startsWith(TEZOS_SIGNED_MESSAGE_PREFIX)) {
    throw new Error('RAW payloads must use Mavryk Signed Message framing');
  }

  return {
    payload: normalizedPayload,
    preview: michelinePreview.preview,
    bytesToSign: getMichelinePayloadBytes(normalizedPayload),
    watermark: MICHELINE_WATERMARK
  };
}

function isTrustedAuthChallengeSignerOrigin(origin?: string) {
  if (!origin) {
    return false;
  }

  try {
    const { hostname, port, protocol } = new URL(origin);

    if ((protocol === 'http:' || protocol === 'https:') && LOCAL_AUTH_CHALLENGE_SIGNER_HOSTS.has(hostname)) {
      return true;
    }

    if (protocol !== 'https:') {
      return false;
    }

    if (port) {
      return false;
    }

    return (
      TRUSTED_AUTH_CHALLENGE_SIGNER_HOSTS.has(hostname) ||
      TRUSTED_AUTH_CHALLENGE_SIGNER_HOST_SUFFIXES.some(hostSuffix => hostname.endsWith(hostSuffix))
    );
  } catch {
    return false;
  }
}

function getMichelinePreview(payload: string): MichelinePreview | null {
  try {
    const value = valueDecoder(Uint8ArrayConsumer.fromHexString(getMichelinePayloadBytes(payload)));
    const decodedString = getDecodedString(value);

    if (decodedString !== undefined) {
      return {
        decodedString,
        preview: decodedString
      };
    }

    const parsed = emitMicheline(value, {
      indent: '  ',
      newline: '\n'
    }).slice(1, -1);

    return parsed.length > 0 ? { preview: parsed } : null;
  } catch {
    return null;
  }
}

function getDecodedString(value: unknown) {
  if (value && typeof value === 'object' && 'string' in value) {
    const maybeString = (value as { string?: unknown }).string;

    return typeof maybeString === 'string' ? maybeString : undefined;
  }

  return undefined;
}
