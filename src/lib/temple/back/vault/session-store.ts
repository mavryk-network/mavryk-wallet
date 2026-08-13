import { nanoid } from 'nanoid';

import { browser } from 'lib/browser';

import {
  clearSessionWrappingKeys,
  deleteSessionWrappingKey,
  getSessionWrappingKey,
  saveSessionWrappingKey
} from './session-wrapping-key-store';

const LEGACY_PASS_HASH_STORE_KEY = '@Vault:session.passHash';
const SESSION_PAYLOAD_STORE_KEY_V2 = '@Vault:session.v2';
const SESSION_PAYLOAD_STORE_KEY_V3 = '@Vault:session.v3';
const SESSION_PAYLOAD_VERSION = 3;
const SESSION_PAYLOAD_TTL_MS = 12 * 60 * 60 * 1000;
const HEX_PATTERN = /^(?:[0-9a-f]{2})+$/i;

type SessionStorageArea = NonNullable<typeof browser.storage.session> & {
  setAccessLevel?: (accessLevel: { accessLevel: 'TRUSTED_CONTEXTS' }) => Promise<void>;
};

type VaultSessionPayloadV3 = {
  version: typeof SESSION_PAYLOAD_VERSION;
  createdAt: number;
  expiresAt: number;
  keyId: string;
  iv: string;
  wrappedPassHash: string;
};

export const saveSessionPassHash = async (passHashBuffer: ArrayBuffer) => {
  const storage = getSessionStorage();
  if (!storage) return;

  let keyId: string | undefined;

  try {
    await restrictSessionAccess(storage);
    await clearSessionWrappingKeys();

    const createdAt = Date.now();
    const expiresAt = createdAt + SESSION_PAYLOAD_TTL_MS;
    keyId = nanoid();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await generateWrappingKey();
    const wrappedPassHash = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, passHashBuffer);
    const payload: VaultSessionPayloadV3 = {
      version: SESSION_PAYLOAD_VERSION,
      createdAt,
      expiresAt,
      keyId,
      iv: bytesToHex(iv),
      wrappedPassHash: bytesToHex(wrappedPassHash)
    };

    await saveSessionWrappingKey({ id: keyId, createdAt, expiresAt, key });
    await storage.remove([LEGACY_PASS_HASH_STORE_KEY, SESSION_PAYLOAD_STORE_KEY_V2]);
    await storage.set({ [SESSION_PAYLOAD_STORE_KEY_V3]: payload });
  } catch (error) {
    console.error(error);
    await storage.remove(SESSION_PAYLOAD_STORE_KEY_V3).catch(removeError => console.error(removeError));
    if (keyId) await deleteSessionWrappingKey(keyId).catch(deleteError => console.error(deleteError));
  }
};

export const getSessionPassKey = async () => {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    await restrictSessionAccess(storage);

    const {
      [LEGACY_PASS_HASH_STORE_KEY]: legacyPassHash,
      [SESSION_PAYLOAD_STORE_KEY_V2]: v2Payload,
      [SESSION_PAYLOAD_STORE_KEY_V3]: payload
    }: {
      [LEGACY_PASS_HASH_STORE_KEY]?: unknown;
      [SESSION_PAYLOAD_STORE_KEY_V2]?: unknown;
      [SESSION_PAYLOAD_STORE_KEY_V3]?: unknown;
    } = await storage.get([LEGACY_PASS_HASH_STORE_KEY, SESSION_PAYLOAD_STORE_KEY_V2, SESSION_PAYLOAD_STORE_KEY_V3]);

    if (legacyPassHash !== undefined || v2Payload !== undefined) {
      await removeSession();
      return;
    }

    if (payload === undefined) {
      await clearSessionWrappingKeys();
      return;
    }

    if (!isVaultSessionPayloadV3(payload)) {
      await removeSession();
      return;
    }

    if (payload.expiresAt <= Date.now()) {
      await removeSession();
      return;
    }

    const key = await getSessionWrappingKey(payload.keyId);
    if (!key) {
      await removeSession();
      return;
    }

    return await crypto.subtle.unwrapKey(
      'raw',
      hexToBytes(payload.wrappedPassHash),
      key,
      { name: 'AES-GCM', iv: hexToBytes(payload.iv) },
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
  } catch (error) {
    console.error(error);
    await removeSession();
  }

  return;
};

export const removeSession = async () => {
  const storage = getSessionStorage();

  try {
    await storage?.remove([LEGACY_PASS_HASH_STORE_KEY, SESSION_PAYLOAD_STORE_KEY_V2, SESSION_PAYLOAD_STORE_KEY_V3]);
  } catch (error) {
    console.error(error);
  }

  try {
    await clearSessionWrappingKeys();
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

function isVaultSessionPayloadV3(payload: unknown): payload is VaultSessionPayloadV3 {
  if (!payload || typeof payload !== 'object') return false;

  const record = payload as Record<string, unknown>;

  return (
    record.version === SESSION_PAYLOAD_VERSION &&
    typeof record.createdAt === 'number' &&
    typeof record.expiresAt === 'number' &&
    typeof record.keyId === 'string' &&
    record.keyId.length > 0 &&
    typeof record.iv === 'string' &&
    isHexBytes(record.iv, 12) &&
    typeof record.wrappedPassHash === 'string' &&
    isHexBytes(record.wrappedPassHash)
  );
}

function isHexBytes(value: string, byteLength?: number) {
  return HEX_PATTERN.test(value) && (byteLength === undefined || value.length === byteLength * 2);
}

function generateWrappingKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'unwrapKey']);
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
