import { char2Bytes, num2PaddedHex } from '@mavrykdynamics/webmavryk-utils';

export const MICHELINE_WATERMARK = '05';
export const MICHELINE_STRING_TAG = '01';
export const MAVRYK_SIGNED_MESSAGE_PREFIX = 'Mavryk Signed Message: ';
export const MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX = 'Mavryk Wallet Authentication';
export const MAVRYK_AUTH_CHALLENGE_AUDIENCE = 'mavryk-wallet-api';
export const AUTH_CHALLENGE_MAX_LENGTH = 1024;
export const AUTH_CHALLENGE_MAX_TTL_MS = 10 * 60 * 1000;
export const AUTH_CHALLENGE_NONCE_PATTERN = /^[A-Za-z0-9._~-]{16,256}$/;
const LEGACY_MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX = `${MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX}: `;
const MAVRYK_AUTH_CHALLENGE_BODY_MARKER = 'Please sign this message to authenticate.';
const MAVRYK_AUTH_CHALLENGE_TRANSACTION_NOTICE =
  'This request will not trigger a blockchain transaction or cost any gas fees.';
const AUTH_CHALLENGE_TIMESTAMP_TOLERANCE_MS = 1_000;
const HEX_BYTES_PATTERN = /^(?:[0-9a-fA-F]{2})+$/;

export type AuthChallengeMessageParams = {
  audience?: string;
  expiresAt: string;
  networkId: string;
  nonce: string;
  walletAddress: string;
};

export type AuthChallengeResponseForSigning = {
  challenge: string;
  expiresAt: string;
  nonce: string;
};

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

export function buildStructuredAuthChallengeMessage({
  audience = MAVRYK_AUTH_CHALLENGE_AUDIENCE,
  expiresAt,
  networkId,
  nonce,
  walletAddress
}: AuthChallengeMessageParams) {
  return [
    MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX,
    '',
    MAVRYK_AUTH_CHALLENGE_BODY_MARKER,
    '',
    `Wallet Address: ${walletAddress}`,
    `Network: ${networkId}`,
    `Nonce: ${nonce}`,
    `Expires At: ${expiresAt}`,
    `Audience: ${audience}`
  ].join('\n');
}

export function buildStructuredAuthChallengePayloadHex(params: AuthChallengeMessageParams) {
  return buildMichelineStringPayloadHex(buildStructuredAuthChallengeMessage(params));
}

export function validateAuthChallengeForSigning(
  response: AuthChallengeResponseForSigning,
  params: Pick<AuthChallengeMessageParams, 'networkId' | 'walletAddress'>,
  nowMs = Date.now()
) {
  if (response.challenge.length > AUTH_CHALLENGE_MAX_LENGTH) {
    throw new Error('Auth challenge is too long');
  }

  if (!AUTH_CHALLENGE_NONCE_PATTERN.test(response.nonce)) {
    throw new Error('Auth challenge nonce is invalid');
  }

  const expiresAtMs = Date.parse(response.expiresAt);

  if (!Number.isFinite(expiresAtMs) || !response.expiresAt.includes('T')) {
    throw new Error('Auth challenge expiration must be an ISO timestamp');
  }

  if (expiresAtMs <= nowMs) {
    throw new Error('Auth challenge is expired');
  }

  if (expiresAtMs - nowMs > AUTH_CHALLENGE_MAX_TTL_MS) {
    throw new Error('Auth challenge expiration is too far in the future');
  }

  const expectedChallenge = buildStructuredAuthChallengeMessage({
    ...params,
    expiresAt: response.expiresAt,
    nonce: response.nonce
  });

  if (response.challenge === expectedChallenge) {
    return response;
  }

  if (!isCurrentBackendAuthChallengeValid(response, params)) {
    throw new Error('Auth challenge does not match the expected structured message');
  }

  return response;
}

export function isStructuredAuthChallengeMessage(message: string) {
  return (
    parseStructuredAuthChallengeMessage(message) !== null || parseCurrentBackendAuthChallengeMessage(message) !== null
  );
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

function parseStructuredAuthChallengeMessage(message: string) {
  const lines = message.split('\n');

  if (
    lines.length !== 9 ||
    lines[0] !== MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX ||
    lines[1] !== '' ||
    lines[2] !== MAVRYK_AUTH_CHALLENGE_BODY_MARKER ||
    lines[3] !== ''
  ) {
    return null;
  }

  const walletAddress = readStructuredField(lines[4], 'Wallet Address');
  const networkId = readStructuredField(lines[5], 'Network');
  const nonce = readStructuredField(lines[6], 'Nonce');
  const expiresAt = readStructuredField(lines[7], 'Expires At');
  const audience = readStructuredField(lines[8], 'Audience');

  if (!walletAddress || !networkId || !nonce || !expiresAt || audience !== MAVRYK_AUTH_CHALLENGE_AUDIENCE) {
    return null;
  }

  return {
    walletAddress,
    networkId,
    nonce,
    expiresAt,
    audience
  };
}

function parseCurrentBackendAuthChallengeMessage(message: string) {
  const lines = message.split('\n');

  if (
    lines.length !== 10 ||
    lines[0] !== MAVRYK_AUTH_CHALLENGE_MESSAGE_PREFIX ||
    lines[1] !== '' ||
    lines[2] !== MAVRYK_AUTH_CHALLENGE_BODY_MARKER ||
    lines[3] !== '' ||
    lines[8] !== '' ||
    lines[9] !== MAVRYK_AUTH_CHALLENGE_TRANSACTION_NOTICE
  ) {
    return null;
  }

  const walletAddress = readStructuredField(lines[4], 'Wallet Address');
  const nonce = readStructuredField(lines[5], 'Nonce');
  const timestamp = readStructuredField(lines[6], 'Timestamp');
  const expiresAt = readStructuredField(lines[7], 'Expires');

  if (!walletAddress || !nonce || !timestamp || !expiresAt) {
    return null;
  }

  return {
    walletAddress,
    nonce,
    timestamp,
    expiresAt
  };
}

function isCurrentBackendAuthChallengeValid(
  response: AuthChallengeResponseForSigning,
  params: Pick<AuthChallengeMessageParams, 'walletAddress'>
) {
  const parsed = parseCurrentBackendAuthChallengeMessage(response.challenge);

  if (!parsed) {
    return false;
  }

  const responseExpiresAtMs = Date.parse(response.expiresAt);
  const challengeExpiresAtMs = Date.parse(parsed.expiresAt);
  const challengeTimestampMs = Date.parse(parsed.timestamp);

  return (
    parsed.walletAddress === params.walletAddress &&
    parsed.nonce === response.nonce &&
    Number.isFinite(challengeTimestampMs) &&
    Number.isFinite(challengeExpiresAtMs) &&
    challengeTimestampMs < challengeExpiresAtMs &&
    Math.abs(challengeExpiresAtMs - responseExpiresAtMs) <= AUTH_CHALLENGE_TIMESTAMP_TOLERANCE_MS
  );
}

function readStructuredField(line: string, fieldName: string) {
  const prefix = `${fieldName}: `;

  return line.startsWith(prefix) ? line.slice(prefix.length) : null;
}
