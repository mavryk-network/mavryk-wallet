import { browser } from 'lib/browser';
import { generateHash, importKey } from 'lib/temple/passworder';

import { encryptAndSaveMany, fetchAndDecryptOne } from './safe-storage';
import { getSessionPassKey, removeSession, saveSessionPassHash } from './session-store';
import {
  clearSessionWrappingKeys,
  getSessionWrappingKey,
  saveSessionWrappingKey,
  type VaultSessionWrappingKeyRecord
} from './session-wrapping-key-store';
import { checkStrgKey } from './storage-keys';

const LEGACY_PASS_HASH_STORE_KEY = '@Vault:session.passHash';
const SESSION_PAYLOAD_STORE_KEY_V2 = '@Vault:session.v2';
const SESSION_PAYLOAD_STORE_KEY_V3 = '@Vault:session.v3';

type BrowserStorageWithSession = typeof browser.storage & {
  session?: typeof browser.storage.local & {
    setAccessLevel?: (accessLevel: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void>;
  };
};

const storage = browser.storage as BrowserStorageWithSession;

let defaultSessionStorage: NonNullable<BrowserStorageWithSession['session']>;

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

const getStoredPayload = async () => {
  const stored = await browser.storage.session!.get(SESSION_PAYLOAD_STORE_KEY_V3);
  return stored[SESSION_PAYLOAD_STORE_KEY_V3] as VaultSessionWrappingKeyRecord & {
    keyId: string;
    iv: string;
    wrappedPassHash: string;
  };
};

describe('vault session store', () => {
  beforeAll(() => {
    if (!storage.session) {
      storage.session = browser.storage.local;
    }

    defaultSessionStorage = storage.session;
  });

  beforeEach(async () => {
    storage.session = defaultSessionStorage;
    delete storage.session.setAccessLevel;
    await browser.storage.local.clear();
    await storage.session.clear();
    await clearSessionWrappingKeys();
  });

  afterEach(async () => {
    storage.session = defaultSessionStorage;
    await removeSession();
    await browser.storage.local.clear();
    jest.restoreAllMocks();
  });

  it('stores v3 session material without raw pass-hash or wrapping key in browser storage', async () => {
    const passHash = await generateHash('password');

    await saveSessionPassHash(passHash);

    const stored = await browser.storage.session!.get(null);
    const payload = stored[SESSION_PAYLOAD_STORE_KEY_V3];

    expect(stored[LEGACY_PASS_HASH_STORE_KEY]).toBeUndefined();
    expect(stored[SESSION_PAYLOAD_STORE_KEY_V2]).toBeUndefined();
    expect(payload).toMatchObject({
      version: 3,
      keyId: expect.any(String),
      iv: expect.any(String),
      wrappedPassHash: expect.any(String)
    });
    expect(payload.wrappingKey).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain(toHex(passHash));

    const wrappingKey = await getSessionWrappingKey(payload.keyId);

    expect(wrappingKey).toBeInstanceOf(CryptoKey);
    expect(wrappingKey?.extractable).toBe(false);
    expect(wrappingKey?.usages).toEqual(expect.arrayContaining(['encrypt', 'unwrapKey']));
    expect(wrappingKey?.usages).not.toContain('decrypt');
  });

  it('recovers a usable non-extractable PBKDF2 session key', async () => {
    const passHash = await generateHash('password');

    await saveSessionPassHash(passHash);

    const recoveredPassKey = await getSessionPassKey();

    expect(recoveredPassKey).toBeInstanceOf(CryptoKey);
    expect(recoveredPassKey?.extractable).toBe(false);
    expect(recoveredPassKey?.usages).toEqual(expect.arrayContaining(['deriveBits', 'deriveKey']));
    await expect(crypto.subtle.exportKey('raw', recoveredPassKey!)).rejects.toThrow();
  });

  it('recovers a session key that can decrypt vault check storage', async () => {
    const passHash = await generateHash('password');
    const passKey = await importKey(passHash);

    await encryptAndSaveMany([[checkStrgKey, 'check']], passKey);
    await saveSessionPassHash(passHash);

    const recoveredPassKey = await getSessionPassKey();

    await expect(fetchAndDecryptOne(checkStrgKey, recoveredPassKey!)).resolves.toBe('check');
  });

  it('removes legacy raw and v2 session material without recovering it', async () => {
    await browser.storage.session!.set({
      [LEGACY_PASS_HASH_STORE_KEY]: 'legacy-raw-pass-hash',
      [SESSION_PAYLOAD_STORE_KEY_V2]: {
        version: 2,
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000,
        wrappingKey: '00',
        iv: '00',
        wrappedPassHash: '00'
      }
    });

    await expect(getSessionPassKey()).resolves.toBeUndefined();
    await expect(
      browser.storage.session!.get([LEGACY_PASS_HASH_STORE_KEY, SESSION_PAYLOAD_STORE_KEY_V2])
    ).resolves.toEqual({});
  });

  it('clears expired session payloads and wrapping keys', async () => {
    const passHash = await generateHash('password');
    await saveSessionPassHash(passHash);

    const payload = await getStoredPayload();
    await browser.storage.session!.set({
      [SESSION_PAYLOAD_STORE_KEY_V3]: {
        ...payload,
        expiresAt: Date.now() - 1
      }
    });

    await expect(getSessionPassKey()).resolves.toBeUndefined();
    await expect(browser.storage.session!.get(SESSION_PAYLOAD_STORE_KEY_V3)).resolves.toEqual({});
    await expect(getSessionWrappingKey(payload.keyId)).resolves.toBeUndefined();
  });

  it('garbage-collects expired orphan wrapping keys during recovery', async () => {
    const passHash = await generateHash('password');
    await saveSessionPassHash(passHash);

    const payload = await getStoredPayload();
    const expiredKeyId = 'expired-orphan-key';
    const expiredKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'unwrapKey'
    ]);
    await saveSessionWrappingKey({
      id: expiredKeyId,
      createdAt: Date.now() - 2000,
      expiresAt: Date.now() - 1000,
      key: expiredKey
    });

    await expect(getSessionWrappingKey(expiredKeyId)).resolves.toBeInstanceOf(CryptoKey);
    await expect(getSessionPassKey()).resolves.toBeInstanceOf(CryptoKey);
    await expect(getSessionWrappingKey(expiredKeyId)).resolves.toBeUndefined();
    await expect(getSessionWrappingKey(payload.keyId)).resolves.toBeInstanceOf(CryptoKey);
  });

  it('clears the session when the wrapping key is missing', async () => {
    const passHash = await generateHash('password');
    await saveSessionPassHash(passHash);

    await clearSessionWrappingKeys();

    await expect(getSessionPassKey()).resolves.toBeUndefined();
    await expect(browser.storage.session!.get(SESSION_PAYLOAD_STORE_KEY_V3)).resolves.toEqual({});
  });

  it('clears invalid or tampered session payloads', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await browser.storage.session!.set({
      [SESSION_PAYLOAD_STORE_KEY_V3]: {
        version: 3,
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000,
        keyId: 'invalid',
        iv: 'invalid',
        wrappedPassHash: 'invalid'
      }
    });

    await expect(getSessionPassKey()).resolves.toBeUndefined();
    await expect(browser.storage.session!.get(SESSION_PAYLOAD_STORE_KEY_V3)).resolves.toEqual({});

    const passHash = await generateHash('password');
    await saveSessionPassHash(passHash);

    const payload = await getStoredPayload();
    await browser.storage.session!.set({
      [SESSION_PAYLOAD_STORE_KEY_V3]: {
        ...payload,
        wrappedPassHash: payload.wrappedPassHash.replace(/.$/, char => (char === '0' ? '1' : '0'))
      }
    });

    await expect(getSessionPassKey()).resolves.toBeUndefined();
    await expect(browser.storage.session!.get(SESSION_PAYLOAD_STORE_KEY_V3)).resolves.toEqual({});
    await expect(getSessionWrappingKey(payload.keyId)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('restricts browser session storage access when the API is available', async () => {
    const setAccessLevel = jest.fn().mockResolvedValue(undefined);
    storage.session!.setAccessLevel = setAccessLevel;

    const passHash = await generateHash('password');
    await saveSessionPassHash(passHash);
    await getSessionPassKey();

    expect(setAccessLevel).toHaveBeenCalledTimes(2);
    expect(setAccessLevel).toHaveBeenNthCalledWith(1, { accessLevel: 'TRUSTED_CONTEXTS' });
    expect(setAccessLevel).toHaveBeenNthCalledWith(2, { accessLevel: 'TRUSTED_CONTEXTS' });
  });

  it('works when setAccessLevel is unavailable', async () => {
    const passHash = await generateHash('password');

    await saveSessionPassHash(passHash);

    await expect(getSessionPassKey()).resolves.toBeInstanceOf(CryptoKey);
  });

  it('logs and ignores setAccessLevel failures', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    storage.session!.setAccessLevel = jest.fn().mockRejectedValue(new Error('access level failed'));
    const passHash = await generateHash('password');

    await saveSessionPassHash(passHash);

    await expect(getSessionPassKey()).resolves.toBeInstanceOf(CryptoKey);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
  });

  it('no-ops when browser session storage is missing', async () => {
    const localGetSpy = jest.spyOn(browser.storage.local, 'get');
    const localSetSpy = jest.spyOn(browser.storage.local, 'set');
    const localRemoveSpy = jest.spyOn(browser.storage.local, 'remove');
    const passHash = await generateHash('password');

    storage.session = undefined;
    localGetSpy.mockClear();
    localSetSpy.mockClear();
    localRemoveSpy.mockClear();

    await expect(saveSessionPassHash(passHash)).resolves.toBeUndefined();
    await expect(getSessionPassKey()).resolves.toBeUndefined();
    await expect(removeSession()).resolves.toBeUndefined();
    expect(localGetSpy).not.toHaveBeenCalled();
    expect(localSetSpy).not.toHaveBeenCalled();
    expect(localRemoveSpy).not.toHaveBeenCalled();
  });

  it('does not use the in-memory wrapping-key fallback outside the test environment', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const processEnv = process.env as Record<string, string | undefined>;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'unwrapKey']);

    await clearSessionWrappingKeys();
    delete processEnv.NODE_ENV;

    try {
      await expect(
        saveSessionWrappingKey({
          id: 'non-test-key',
          createdAt: Date.now(),
          expiresAt: Date.now() + 1000,
          key
        })
      ).rejects.toThrow('IndexedDB is unavailable for vault session wrapping keys');
      await expect(getSessionWrappingKey('non-test-key')).resolves.toBeUndefined();
    } finally {
      processEnv.NODE_ENV = originalNodeEnv;
      await clearSessionWrappingKeys();
    }
  });
});
