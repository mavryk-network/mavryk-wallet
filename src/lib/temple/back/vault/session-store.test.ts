import { browser } from 'lib/browser';
import { generateHash } from 'lib/temple/passworder';

import { getSessionPassHash, removeSession, saveSessionPassHash } from './session-store';

const LEGACY_PASS_HASH_STORE_KEY = '@Vault:session.passHash';
const SESSION_PAYLOAD_STORE_KEY = '@Vault:session.v2';

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

describe('vault session store', () => {
  beforeAll(() => {
    if (!browser.storage.session) {
      (browser.storage as { session?: typeof browser.storage.local }).session = browser.storage.local;
    }
  });

  beforeEach(async () => {
    await browser.storage.session?.clear();
  });

  afterEach(async () => {
    await removeSession();
  });

  it('stores wrapped versioned session material instead of raw password hash', async () => {
    const passHash = await generateHash('password');

    await saveSessionPassHash(passHash);

    const stored = await browser.storage.session!.get(null);
    const payload = stored[SESSION_PAYLOAD_STORE_KEY];

    expect(stored[LEGACY_PASS_HASH_STORE_KEY]).toBeUndefined();
    expect(payload).toMatchObject({
      version: 2,
      wrappingKey: expect.any(String),
      iv: expect.any(String),
      wrappedPassHash: expect.any(String)
    });
    expect(payload.wrappedPassHash).not.toBe(toHex(passHash));

    const recoveredPassHash = await getSessionPassHash();
    expect(recoveredPassHash && toHex(recoveredPassHash)).toBe(toHex(passHash));
  });

  it('ignores and clears legacy raw pass-hash session material', async () => {
    await browser.storage.session!.set({ [LEGACY_PASS_HASH_STORE_KEY]: 'legacy-raw-pass-hash' });

    await expect(getSessionPassHash()).resolves.toBeUndefined();
    await expect(browser.storage.session!.get(LEGACY_PASS_HASH_STORE_KEY)).resolves.toEqual({});
  });

  it('clears expired session payloads', async () => {
    const passHash = await generateHash('password');
    await saveSessionPassHash(passHash);

    const stored = await browser.storage.session!.get(SESSION_PAYLOAD_STORE_KEY);
    await browser.storage.session!.set({
      [SESSION_PAYLOAD_STORE_KEY]: {
        ...stored[SESSION_PAYLOAD_STORE_KEY],
        expiresAt: Date.now() - 1
      }
    });

    await expect(getSessionPassHash()).resolves.toBeUndefined();
    await expect(browser.storage.session!.get(SESSION_PAYLOAD_STORE_KEY)).resolves.toEqual({});
  });
});
