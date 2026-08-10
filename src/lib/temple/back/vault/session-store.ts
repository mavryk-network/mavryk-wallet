import { browser } from 'lib/browser';

const LEGACY_PASS_HASH_STORE_KEY = '@Vault:session.passHash';
const SESSION_PAYLOAD_STORE_KEY = '@Vault:session.v2';
const SESSION_PAYLOAD_VERSION = 2;
const SESSION_PAYLOAD_TTL_MS = 12 * 60 * 60 * 1000;
const HEX_PATTERN = /^(?:[0-9a-f]{2})+$/i;

type SessionStorageArea = NonNullable<typeof browser.storage.session> & {
  setAccessLevel?: (accessLevel: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void>;
};

type VaultSessionPayloadV2 = {
  version: typeof SESSION_PAYLOAD_VERSION;
  createdAt: number;
  expiresAt: number;
  wrappingKey: string;
  iv: string;
  wrappedPassHash: string;
};

export const saveSessionPassHash = async (passHashBuffer: ArrayBuffer) => {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    await restrictSessionAccess(storage);

    const createdAt = Date.now();
    const wrappingKey = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await importWrappingKey(wrappingKey);
    const wrappedPassHash = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, passHashBuffer);
    const payload: VaultSessionPayloadV2 = {
      version: SESSION_PAYLOAD_VERSION,
      createdAt,
      expiresAt: createdAt + SESSION_PAYLOAD_TTL_MS,
      wrappingKey: bytesToHex(wrappingKey),
      iv: bytesToHex(iv),
      wrappedPassHash: bytesToHex(wrappedPassHash)
    };

    await storage.remove(LEGACY_PASS_HASH_STORE_KEY);
    await storage.set({ [SESSION_PAYLOAD_STORE_KEY]: payload });
  } catch (error) {
    console.error(error);
  }
};

export const getSessionPassHash = async () => {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    await restrictSessionAccess(storage);

    const {
      [LEGACY_PASS_HASH_STORE_KEY]: legacyPassHash,
      [SESSION_PAYLOAD_STORE_KEY]: payload
    }: {
      [LEGACY_PASS_HASH_STORE_KEY]?: unknown;
      [SESSION_PAYLOAD_STORE_KEY]?: unknown;
    } = await storage.get([LEGACY_PASS_HASH_STORE_KEY, SESSION_PAYLOAD_STORE_KEY]);

    if (legacyPassHash !== undefined) {
      await storage.remove(LEGACY_PASS_HASH_STORE_KEY);
    }

    if (!isVaultSessionPayloadV2(payload)) {
      if (payload !== undefined) await removeSession();
      return;
    }

    if (payload.expiresAt <= Date.now()) {
      await removeSession();
      return;
    }

    const key = await importWrappingKey(hexToBytes(payload.wrappingKey));
    const passHash = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBytes(payload.iv) },
      key,
      hexToBytes(payload.wrappedPassHash)
    );

    return passHash;
  } catch (error) {
    console.error(error);
    await removeSession();
  }

  return;
};

export const removeSession = async () => {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    await storage.remove([LEGACY_PASS_HASH_STORE_KEY, SESSION_PAYLOAD_STORE_KEY]);
  } catch (error) {
    console.error(error);
  }
};

function getSessionStorage() {
  return browser.storage.session as SessionStorageArea | undefined;
}

async function restrictSessionAccess(storage: SessionStorageArea) {
  try {
    await storage.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' });
  } catch (error) {
    console.error(error);
  }
}

function isVaultSessionPayloadV2(payload: unknown): payload is VaultSessionPayloadV2 {
  if (!payload || typeof payload !== 'object') return false;

  const record = payload as Record<string, unknown>;

  return (
    record.version === SESSION_PAYLOAD_VERSION &&
    typeof record.createdAt === 'number' &&
    typeof record.expiresAt === 'number' &&
    typeof record.wrappingKey === 'string' &&
    isHexBytes(record.wrappingKey, 32) &&
    typeof record.iv === 'string' &&
    isHexBytes(record.iv, 12) &&
    typeof record.wrappedPassHash === 'string' &&
    isHexBytes(record.wrappedPassHash)
  );
}

function isHexBytes(value: string, byteLength?: number) {
  return HEX_PATTERN.test(value) && (byteLength === undefined || value.length === byteLength * 2);
}

function importWrappingKey(keyData: ArrayBuffer | Uint8Array) {
  return crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}
