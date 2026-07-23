import { buildLegacyAuthChallengePayloadHex, MICHELINE_WATERMARK } from './auth-payload.helpers';
import { signAuthChallengeWithVault } from './utils';

describe('signAuthChallengeWithVault', () => {
  it('signs the verifier-compatible auth challenge with an explicit Micheline watermark', async () => {
    const sign = jest.fn().mockResolvedValue({ prefixSig: 'prefix-sig' });
    const revealPublicKey = jest.fn().mockResolvedValue('public-key');
    const vault = { sign, revealPublicKey } as unknown as Parameters<typeof signAuthChallengeWithVault>[0];
    const payload = buildLegacyAuthChallengePayloadHex('challenge');

    await expect(signAuthChallengeWithVault(vault, 'mv1-auth-wallet', 'challenge')).resolves.toBe(
      'public-key:prefix-sig'
    );

    expect(sign).toHaveBeenCalledWith(
      'mv1-auth-wallet',
      payload.slice(MICHELINE_WATERMARK.length),
      MICHELINE_WATERMARK
    );
    expect(revealPublicKey).toHaveBeenCalledWith('mv1-auth-wallet');
  });
});
