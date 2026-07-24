import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import type { TempleContactApiType } from 'lib/temple/types';

import { mavrykApi, type MavrykApiRequestConfig } from './client';
import { fetchContactsRecord, saveContactsRecord } from './contacts';

jest.mock('@vespaiach/axios-fetch-adapter', () => jest.fn());

type EncryptedValue = {
  ciphertext: string;
  iv: string;
  timestamp: number;
  version: string;
};

type GroupedContactsPayload = Record<
  TempleContactApiType,
  { address: string; name: string; type: TempleContactApiType }[]
>;

const PUBLIC_KEY = 'edpk-public-key';
const AUTH_CONTEXT = {
  walletAddress: 'mv1-auth-wallet',
  networkId: 'mainnet'
};
const GROUPED_CONTACTS: GroupedContactsPayload = {
  user: [{ address: 'mv1-alice', name: 'Alice', type: 'user' }],
  validator: [],
  contract: []
};

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array) {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

function parseAdapterData(data: unknown) {
  return typeof data === 'string' ? JSON.parse(data) : data;
}

function createResponse(config: AxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    config,
    data,
    headers: {},
    status: 200,
    statusText: 'OK'
  };
}

function buildRecord(encryptedValue: EncryptedValue) {
  return {
    accountId: 'account-id',
    createdAt: '2026-07-24T00:00:00.000Z',
    dataKey: 'contacts',
    dataType: 'contacts',
    encryptedValue,
    id: 'record-id',
    updatedAt: '2026-07-24T00:00:00.000Z'
  };
}

async function deriveLegacyAccountDataKey(publicKey: string) {
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(publicKey), 'PBKDF2', false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('mavryk-wallet'),
      iterations: 100_000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-CBC', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function generateAccountDataKey() {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawKey = await crypto.subtle.exportKey('raw', key);

  return bytesToBase64(new Uint8Array(rawKey));
}

async function importAccountDataKey(accountDataKey: string) {
  return crypto.subtle.importKey('raw', base64ToBytes(accountDataKey), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt'
  ]);
}

async function encryptCurrentPayload(payload: GroupedContactsPayload, accountDataKey: string): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await importAccountDataKey(accountDataKey),
    encoder.encode(JSON.stringify(payload))
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
    timestamp: Date.now(),
    version: 'AES-256-GCM-2'
  };
}

async function encryptLegacyPayload(payload: GroupedContactsPayload, publicKey: string): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    await deriveLegacyAccountDataKey(publicKey),
    encoder.encode(JSON.stringify(payload))
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
    timestamp: Date.now(),
    version: 'AES-256-CBC-1'
  };
}

describe('contacts account data encryption', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves contacts as v2 AES-GCM encrypted data with a local account data key', async () => {
    const savedEncryptedValues: EncryptedValue[] = [];
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      const body = parseAdapterData((config as MavrykApiRequestConfig).data) as {
        encryptedValue: EncryptedValue;
      };

      savedEncryptedValues.push(body.encryptedValue);

      return createResponse(config, buildRecord(body.encryptedValue));
    });

    mavrykApi.defaults.adapter = adapter;

    const saved = await saveContactsRecord({
      contacts: [{ address: 'mv1-alice', name: 'Alice' }],
      typesByAddress: {
        'mv1-alice': 'user'
      },
      authContext: AUTH_CONTEXT
    });

    const savedEncryptedValue = savedEncryptedValues[0];

    if (!savedEncryptedValue) {
      throw new Error('Expected contacts to be encrypted before saving');
    }

    expect(savedEncryptedValue.version).toBe('AES-256-GCM-2');
    expect(base64ToBytes(savedEncryptedValue.iv)).toHaveLength(12);
    expect(base64ToBytes(saved.accountDataKey)).toHaveLength(32);
    expect(saved.contacts).toEqual([{ address: 'mv1-alice', name: 'Alice' }]);
    expect(saved.typesByAddress).toEqual({
      'mv1-alice': 'user'
    });
  });

  it('fetches v2 contacts only when the local account data key is available', async () => {
    const accountDataKey = await generateAccountDataKey();
    const encryptedValue = await encryptCurrentPayload(GROUPED_CONTACTS, accountDataKey);
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    await expect(fetchContactsRecord({ publicKey: PUBLIC_KEY, authContext: AUTH_CONTEXT })).rejects.toThrow(
      'Missing local contacts encryption key'
    );

    await expect(
      fetchContactsRecord({
        accountDataKey,
        publicKey: PUBLIC_KEY,
        authContext: AUTH_CONTEXT
      })
    ).resolves.toMatchObject({
      accountDataKey,
      contacts: [{ address: 'mv1-alice', name: 'Alice' }],
      recordId: 'record-id',
      typesByAddress: {
        'mv1-alice': 'user'
      }
    });
  });

  it('keeps legacy v1 public-key encrypted contacts readable and returns a new local key', async () => {
    const encryptedValue = await encryptLegacyPayload(GROUPED_CONTACTS, PUBLIC_KEY);
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    const fetched = await fetchContactsRecord({
      publicKey: PUBLIC_KEY,
      authContext: AUTH_CONTEXT
    });

    expect(fetched.contacts).toEqual([{ address: 'mv1-alice', name: 'Alice' }]);
    expect(fetched.recordId).toBe('record-id');
    expect(fetched.typesByAddress).toEqual({
      'mv1-alice': 'user'
    });
    expect(base64ToBytes(fetched.accountDataKey ?? '')).toHaveLength(32);
  });
});
