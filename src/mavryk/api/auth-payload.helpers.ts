import { char2Bytes, num2PaddedHex } from '@mavrykdynamics/webmavryk-utils';

export const MICHELINE_WATERMARK = '05';
export const MICHELINE_STRING_TAG = '01';
export const MAVRYK_SIGNED_MESSAGE_PREFIX = 'Mavryk Signed Message: ';
export const MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX = 'Mavryk Wallet Authentication';
const LEGACY_MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX = `${MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX}: `;
const MAVRYK_AUTH_CHALLENGE_BODY_MARKER = 'Please sign this message to authenticate.';
const HEX_BYTES_PATTERN = /^(?:[0-9a-fA-F]{2})+$/;

export function utf8ToHex(message: string) {
  return char2Bytes(message);
}

export function buildMichelineStringPayloadHex(message: string) {
  const messageHex = utf8ToHex(message);
  const lengthHex = num2PaddedHex(messageHex.length / 2, 32);

  return `${MICHELINE_WATERMARK}${MICHELINE_STRING_TAG}${lengthHex}${messageHex}`;
}

export function buildLegacyAuthChallengePayloadHex(challenge: string) {
  return buildMichelineStringPayloadHex(utf8ToHex(challenge));
}

export function getMichelinePayloadBytes(payloadHex: string) {
  const normalizedPayload = stripHexPrefix(payloadHex);

  if (!normalizedPayload.startsWith(MICHELINE_WATERMARK)) {
    throw new Error('Payload is not Micheline-framed');
  }

  return normalizedPayload.slice(MICHELINE_WATERMARK.length);
}

export function buildMavrykSignedMessage(message: string) {
  return `${MAVRYK_SIGNED_MESSAGE_PREFIX}${message}`;
}

export function buildMavrykSignedMessagePayloadHex(message: string) {
  return buildMichelineStringPayloadHex(buildMavrykSignedMessage(message));
}

export function buildAuthChallengeMessage(challenge: string) {
  return isAuthChallengeMessage(challenge) ? challenge : `${LEGACY_MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX}${challenge}`;
}

export function buildAuthChallengePayloadHex(challenge: string) {
  return buildMichelineStringPayloadHex(buildAuthChallengeMessage(challenge));
}

export function isAuthChallengeMessage(message: string) {
  const trimmedMessage = message.trimStart();

  return (
    trimmedMessage.startsWith(LEGACY_MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX) ||
    (trimmedMessage.startsWith(MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX) &&
      trimmedMessage.includes(MAVRYK_AUTH_CHALLENGE_BODY_MARKER))
  );
}

export function isAuthChallengeMessageOrHex(message: string) {
  const decodedMessage = decodeHexUtf8(message);

  return isAuthChallengeMessage(message) || Boolean(decodedMessage && isAuthChallengeMessage(decodedMessage));
}

function decodeHexUtf8(message: string) {
  if (!HEX_BYTES_PATTERN.test(message)) {
    return null;
  }

  try {
    return decodeURIComponent(message.replace(/../g, hexByte => `%${hexByte}`));
  } catch {
    return null;
  }
}

function stripHexPrefix(payloadHex: string) {
  return payloadHex.startsWith('0x') || payloadHex.startsWith('0X') ? payloadHex.slice(2) : payloadHex;
}
