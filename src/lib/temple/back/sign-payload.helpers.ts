import { valueDecoder } from '@mavrykdynamics/webmavryk-local-forging/dist/lib/michelson/codec';
import { Uint8ArrayConsumer } from '@mavrykdynamics/webmavryk-local-forging/dist/lib/uint8array-consumer';
import { emitMicheline } from '@mavrykdynamics/webmavryk-michel-codec';

import {
  getMichelinePayloadBytes,
  isAuthChallengeMessageOrHex,
  MICHELINE_WATERMARK
} from 'mavryk/api/auth-payload.helpers';

import { isTrustedAuthChallengeSignerOrigin } from './trusted-origin.helpers';

const HEX_BYTES_PATTERN = /^(?:[0-9a-fA-F]{2})+$/;
const FORBIDDEN_SIGN_PAYLOAD_PREFIXES = new Set(['01', '02', '03']);
const TEZOS_SIGNED_MESSAGE_PREFIX = 'Tezos Signed Message: ';

type MichelinePreview = {
  preview: string;
  texts: string[];
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
    michelinePreview.texts.some(text => isAuthChallengeMessageOrHex(text)) &&
    !isTrustedAuthChallengeSignerOrigin(origin)
  ) {
    throw new Error('Auth challenge payloads cannot be signed by dApps');
  }

  if (michelinePreview.texts.some(text => text.startsWith(TEZOS_SIGNED_MESSAGE_PREFIX))) {
    throw new Error('RAW payloads must use Mavryk Signed Message framing');
  }

  return {
    payload: normalizedPayload,
    preview: michelinePreview.preview,
    bytesToSign: getMichelinePayloadBytes(normalizedPayload),
    watermark: MICHELINE_WATERMARK
  };
}

function getMichelinePreview(payload: string): MichelinePreview | null {
  try {
    const consumer = Uint8ArrayConsumer.fromHexString(getMichelinePayloadBytes(payload));
    const value = valueDecoder(consumer);

    // Every signed byte must belong to the previewed value: reject trailing bytes and length overruns.
    if (consumer.length() !== 0) {
      return null;
    }

    const texts = collectMichelineTexts(value);
    const decodedString = getDecodedString(value);

    if (decodedString !== undefined) {
      return {
        texts,
        preview: decodedString
      };
    }

    const parsed = emitMicheline(value, {
      indent: '  ',
      newline: '\n'
    }).slice(1, -1);

    return parsed.length > 0 ? { preview: parsed, texts } : null;
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

/** Every string and UTF-8-decoded bytes literal in the value, so policy checks cover nested and non-string framings. */
function collectMichelineTexts(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectMichelineTexts);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  if ('string' in value && typeof value.string === 'string') {
    return [value.string];
  }

  if ('bytes' in value && typeof value.bytes === 'string') {
    return [Buffer.from(value.bytes, 'hex').toString('utf8')];
  }

  return 'args' in value && Array.isArray(value.args) ? value.args.flatMap(collectMichelineTexts) : [];
}
