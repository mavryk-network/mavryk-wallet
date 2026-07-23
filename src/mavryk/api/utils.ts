import { Vault } from 'lib/temple/back/vault';

import {
  buildLegacyAuthChallengePayloadHex,
  getMichelinePayloadBytes,
  MICHELINE_WATERMARK
} from './auth-payload.helpers';

export * from './auth-payload.helpers';

export async function signAuthChallengeWithVault(vault: Vault, accountPkh: string, challenge: string) {
  const payloadHex = buildLegacyAuthChallengePayloadHex(challenge);

  const { prefixSig } = await vault.sign(accountPkh, getMichelinePayloadBytes(payloadHex), MICHELINE_WATERMARK);

  const publicKey = await vault.revealPublicKey(accountPkh);

  return `${publicKey}:${prefixSig}`;
}
