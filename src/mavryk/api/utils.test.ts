import {
  buildMichelineStringPayloadHex,
  buildStructuredAuthChallengeMessage,
  MICHELINE_WATERMARK
} from './auth-payload.helpers';
import { signAuthChallengeWithVault } from './utils';

describe('signAuthChallengeWithVault', () => {
  it('signs a structured auth challenge with an explicit Micheline watermark', async () => {
    const sign = jest.fn().mockResolvedValue({ prefixSig: 'prefix-sig' });
    const revealPublicKey = jest.fn().mockResolvedValue('public-key');
    const vault = { sign, revealPublicKey } as unknown as Parameters<typeof signAuthChallengeWithVault>[0];
    const challenge = buildStructuredAuthChallengeMessage({
      walletAddress: 'mv1-auth-wallet',
      networkId: 'mainnet',
      nonce: 'nonce-1234567890',
      expiresAt: '2030-01-01T00:05:00.000Z'
    });
    const payload = buildMichelineStringPayloadHex(challenge);

    await expect(signAuthChallengeWithVault(vault, 'mv1-auth-wallet', challenge)).resolves.toBe(
      'public-key:prefix-sig'
    );

    expect(sign).toHaveBeenCalledWith(
      'mv1-auth-wallet',
      payload.slice(MICHELINE_WATERMARK.length),
      MICHELINE_WATERMARK
    );
    expect(revealPublicKey).toHaveBeenCalledWith('mv1-auth-wallet');
  });

  it('rejects arbitrary legacy auth challenge text', async () => {
    const sign = jest.fn();
    const revealPublicKey = jest.fn();
    const vault = { sign, revealPublicKey } as unknown as Parameters<typeof signAuthChallengeWithVault>[0];

    await expect(signAuthChallengeWithVault(vault, 'mv1-auth-wallet', 'challenge')).rejects.toThrow(
      'Auth challenge must use the structured Mavryk Wallet authentication format'
    );
    expect(sign).not.toHaveBeenCalled();
    expect(revealPublicKey).not.toHaveBeenCalled();
  });
});
