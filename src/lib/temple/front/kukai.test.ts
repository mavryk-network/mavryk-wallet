/** @jest-environment node */

import { decryptKukaiSeedPhrase } from './kukai';

jest.mock('lib/i18n', () => ({ t: (id: string) => id }));

// Synthetic v3 fixture: zero entropy encrypted with the legacy password "old".
const legacyFile = JSON.stringify({
  version: 3,
  walletType: 0,
  iv: '00000000000000000000000000000000',
  encryptedEntropy: '792d7ec64d15517950521a84b53bed8c==18badf8aba00b0d603b470be5db6697a'
});

it('decrypts legacy files whose original password does not meet the new-vault policy', async () => {
  await expect(decryptKukaiSeedPhrase(legacyFile, 'old')).resolves.toBe(
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
  );
}, 20000);
