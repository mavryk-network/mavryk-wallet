import { char2Bytes, buf2hex, num2PaddedHex } from '@mavrykdynamics/webmavryk-utils';

import { Vault } from 'lib/temple/back/vault';

const MICHELINE_PREFIX = '05';
const MICHELINE_STRING_TAG = '01';

export function utf8ToHex(message: string) {
  const bytes = new TextEncoder().encode(message);
  return buf2hex(bytes);
}

export function buildMichelineStringPayloadHex(message: string) {
  const messageHex = utf8ToHex(message);
  const messageHexBytes = char2Bytes(messageHex);
  const messageHexBytesLength = messageHexBytes.length / 2;
  const lengthHex = num2PaddedHex(messageHexBytesLength, 32);

  return `${MICHELINE_PREFIX}${MICHELINE_STRING_TAG}${lengthHex}${messageHexBytes}`;
}

export async function signAuthChallengeWithVault(vault: Vault, accountPkh: string, challenge: string) {
  const payloadHex = buildMichelineStringPayloadHex(challenge);

  const { prefixSig } = await vault.sign(accountPkh, payloadHex);

  const publicKey = await vault.revealPublicKey(accountPkh);

  return `${publicKey}:${prefixSig}`;
}
