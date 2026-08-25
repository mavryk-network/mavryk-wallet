import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import {
  CONTACTS_ENCRYPTION_VERSION,
  CONTACTS_LEGACY_GCM_ENCRYPTION_VERSION,
  buildContactsAad
} from 'lib/temple/contacts-crypto';
import type { ContactsCurrentKey } from 'lib/temple/contacts-crypto';
import type { TempleContactApiType } from 'lib/temple/types';

import { mavrykApi, type MavrykApiRequestConfig } from './client';
import {
  CurrentContactsRecordDecryptionError,
  deleteContactsRecord,
  fetchContactsRecord,
  saveContactsRecord
} from './contacts';

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
const CONTACTS_KEY: ContactsCurrentKey = {
  key: bytesToBase64(new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 1))),
  bookAddr: AUTH_CONTEXT.walletAddress
};
const LEGACY_DERIVED_CONTACTS_KEY: ContactsCurrentKey = {
  key: bytesToBase64(new Uint8Array(Array.from({ length: 32 }, (_, index) => 32 - index))),
  bookAddr: AUTH_CONTEXT.walletAddress
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

function createAxiosError(config: AxiosRequestConfig, status: number, data: unknown) {
  return {
    config,
    isAxiosError: true,
    response: {
      config,
      data,
      headers: {},
      status,
      statusText: status === 404 ? 'Not Found' : 'Error'
    }
  };
}

function buildRecord(encryptedValue: EncryptedValue, id = 'record-id') {
  return {
    accountId: 'account-id',
    createdAt: '2026-07-24T00:00:00.000Z',
    dataKey: 'contacts',
    dataType: 'contacts',
    encryptedValue,
    id,
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

async function deriveSharedAccountDataKey(publicKey: string) {
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(publicKey), 'PBKDF2', false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode('mavryk-wallet'),
      iterations: 100_000,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  return bytesToBase64(new Uint8Array(derivedBits));
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

async function encryptCurrentPayload(
  payload: GroupedContactsPayload,
  accountDataKey: string,
  bookAddr?: string,
  version = CONTACTS_ENCRYPTION_VERSION
): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, ...(bookAddr ? { additionalData: buildContactsAad(bookAddr, version) } : {}) },
    await importAccountDataKey(accountDataKey),
    encoder.encode(JSON.stringify(payload))
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
    timestamp: Date.now(),
    version
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

  it('saves contacts as current AES-GCM encrypted data with the derived contacts key', async () => {
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
      contactsKey: CONTACTS_KEY,
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

    expect(savedEncryptedValue.version).toBe(CONTACTS_ENCRYPTION_VERSION);
    expect(base64ToBytes(savedEncryptedValue.iv)).toHaveLength(12);
    expect(saved.contacts).toEqual([{ address: 'mv1-alice', name: 'Alice' }]);
    expect(saved.typesByAddress).toEqual({
      'mv1-alice': 'user'
    });
  });

  it('binds current contacts to the contacts book AAD', async () => {
    const encryptedValue = await encryptCurrentPayload(GROUPED_CONTACTS, CONTACTS_KEY.key, CONTACTS_KEY.bookAddr);
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    await expect(
      fetchContactsRecord({
        contactsKey: CONTACTS_KEY,
        authContext: AUTH_CONTEXT
      })
    ).resolves.toMatchObject({
      contacts: [{ address: 'mv1-alice', name: 'Alice' }],
      recordId: 'record-id'
    });

    await expect(
      fetchContactsRecord({
        contactsKey: { ...CONTACTS_KEY, bookAddr: 'mv1-other-book' },
        authContext: AUTH_CONTEXT
      })
    ).rejects.toThrow('Unable to decrypt current contacts record');
  });

  it('does not use the public-key-derived legacy GCM key for new writes', async () => {
    const savedEncryptedValues: EncryptedValue[] = [];
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      const body = parseAdapterData((config as MavrykApiRequestConfig).data) as {
        encryptedValue: EncryptedValue;
      };

      savedEncryptedValues.push(body.encryptedValue);

      return createResponse(config, buildRecord(body.encryptedValue));
    });

    mavrykApi.defaults.adapter = adapter;

    const sharedAccountDataKey = await deriveSharedAccountDataKey(PUBLIC_KEY);
    const saved = await saveContactsRecord({
      contactsKey: CONTACTS_KEY,
      contacts: [{ address: 'mv1-alice', name: 'Alice' }],
      authContext: AUTH_CONTEXT
    });

    expect(savedEncryptedValues[0]?.version).toBe(CONTACTS_ENCRYPTION_VERSION);
    expect(saved).not.toHaveProperty('accountDataKey');

    mavrykApi.defaults.adapter = jest.fn(async (config: AxiosRequestConfig) =>
      createResponse(config, buildRecord(savedEncryptedValues[0]!))
    );

    await expect(
      fetchContactsRecord({
        contactsKey: { key: sharedAccountDataKey, bookAddr: CONTACTS_KEY.bookAddr },
        authContext: AUTH_CONTEXT
      })
    ).rejects.toThrow('Unable to decrypt current contacts record');
  });

  it('creates a contacts record when the cached record id no longer exists', async () => {
    const calls: MavrykApiRequestConfig[] = [];
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      const requestConfig = config as MavrykApiRequestConfig;
      calls.push(requestConfig);

      if (requestConfig.url === '/account/data/stale-record-id') {
        throw createAxiosError(config, 404, { error: 'Data not found', code: 'not_found' });
      }

      const body = parseAdapterData(requestConfig.data) as {
        encryptedValue: EncryptedValue;
      };

      return createResponse(config, buildRecord(body.encryptedValue));
    });

    mavrykApi.defaults.adapter = adapter;

    const saved = await saveContactsRecord({
      contactsKey: CONTACTS_KEY,
      contacts: [{ address: 'mv1-alice', name: 'Alice' }],
      recordId: 'stale-record-id',
      typesByAddress: {
        'mv1-alice': 'user'
      },
      authContext: AUTH_CONTEXT
    });

    expect(calls.map(({ method, url }) => `${method}:${url}`)).toEqual([
      'put:/account/data/stale-record-id',
      'post:/account/data'
    ]);
    expect(saved.recordId).toBe('record-id');
    expect(saved.contacts).toEqual([{ address: 'mv1-alice', name: 'Alice' }]);
  });

  it('updates the existing contacts record when a first v2 create conflicts with a legacy row', async () => {
    const encryptedLegacyValue = await encryptLegacyPayload(GROUPED_CONTACTS, PUBLIC_KEY);
    const calls: MavrykApiRequestConfig[] = [];
    const savedEncryptedValues: EncryptedValue[] = [];
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      const requestConfig = config as MavrykApiRequestConfig;
      calls.push(requestConfig);

      if (requestConfig.method === 'post' && requestConfig.url === '/account/data') {
        throw createAxiosError(config, 409, { error: 'Data already exists', code: 'conflict' });
      }

      if (requestConfig.method === 'get' && requestConfig.url === '/account/data/contacts/contacts') {
        return createResponse(config, buildRecord(encryptedLegacyValue, 'legacy-record-id'));
      }

      if (requestConfig.method === 'put' && requestConfig.url === '/account/data/legacy-record-id') {
        const body = parseAdapterData(requestConfig.data) as {
          encryptedValue: EncryptedValue;
        };

        savedEncryptedValues.push(body.encryptedValue);

        return createResponse(config, buildRecord(body.encryptedValue, 'legacy-record-id'));
      }

      throw new Error(`Unexpected request: ${requestConfig.method} ${requestConfig.url}`);
    });

    mavrykApi.defaults.adapter = adapter;

    const saved = await saveContactsRecord({
      contactsKey: CONTACTS_KEY,
      contacts: [
        { address: 'mv1-bob', name: 'Bob' },
        { address: 'mv1-alice', name: 'Alice' }
      ],
      typesByAddress: {
        'mv1-alice': 'user',
        'mv1-bob': 'user'
      },
      authContext: AUTH_CONTEXT
    });

    expect(calls.map(({ method, url }) => `${method}:${url}`)).toEqual([
      'post:/account/data',
      'get:/account/data/contacts/contacts',
      'put:/account/data/legacy-record-id'
    ]);
    expect(savedEncryptedValues[0]?.version).toBe(CONTACTS_ENCRYPTION_VERSION);
    expect(saved.recordId).toBe('legacy-record-id');
    expect(saved.contacts).toEqual([
      { address: 'mv1-bob', name: 'Bob' },
      { address: 'mv1-alice', name: 'Alice' }
    ]);
  });

  it('reads old random-key GCM2 contacts only through the read-only legacy key candidate', async () => {
    const accountDataKey = await generateAccountDataKey();
    const encryptedValue = await encryptCurrentPayload(
      GROUPED_CONTACTS,
      accountDataKey,
      undefined,
      CONTACTS_LEGACY_GCM_ENCRYPTION_VERSION
    );
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    await expect(
      fetchContactsRecord({ contactsKey: CONTACTS_KEY, legacyPublicKey: PUBLIC_KEY, authContext: AUTH_CONTEXT })
    ).rejects.toThrow('Unable to decrypt current contacts record');

    await expect(
      fetchContactsRecord({
        contactsKey: CONTACTS_KEY,
        legacyAccountDataKey: accountDataKey,
        legacyPublicKey: PUBLIC_KEY,
        authContext: AUTH_CONTEXT
      })
    ).resolves.toMatchObject({
      contacts: [{ address: 'mv1-alice', name: 'Alice' }],
      recordId: 'record-id',
      shouldReencrypt: true,
      typesByAddress: {
        'mv1-alice': 'user'
      }
    });
  });

  it('reads PR-era derived-key GCM2 contacts with version-bound AAD and marks them for re-encryption', async () => {
    const encryptedValue = await encryptCurrentPayload(
      GROUPED_CONTACTS,
      LEGACY_DERIVED_CONTACTS_KEY.key,
      LEGACY_DERIVED_CONTACTS_KEY.bookAddr,
      CONTACTS_LEGACY_GCM_ENCRYPTION_VERSION
    );
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    await expect(
      fetchContactsRecord({
        contactsKey: CONTACTS_KEY,
        authContext: AUTH_CONTEXT
      })
    ).rejects.toThrow('Unable to decrypt current contacts record');

    await expect(
      fetchContactsRecord({
        contactsKey: CONTACTS_KEY,
        legacyContactsKeys: [LEGACY_DERIVED_CONTACTS_KEY],
        authContext: AUTH_CONTEXT
      })
    ).resolves.toMatchObject({
      contacts: [{ address: 'mv1-alice', name: 'Alice' }],
      recordId: 'record-id',
      shouldReencrypt: true,
      typesByAddress: {
        'mv1-alice': 'user'
      }
    });
  });

  it('reads current GCM3 contacts encrypted with a derived compatibility key and marks them for re-encryption', async () => {
    const encryptedValue = await encryptCurrentPayload(
      GROUPED_CONTACTS,
      LEGACY_DERIVED_CONTACTS_KEY.key,
      LEGACY_DERIVED_CONTACTS_KEY.bookAddr
    );
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    await expect(
      fetchContactsRecord({
        contactsKey: CONTACTS_KEY,
        legacyContactsKeys: [LEGACY_DERIVED_CONTACTS_KEY],
        authContext: AUTH_CONTEXT
      })
    ).resolves.toMatchObject({
      contacts: [{ address: 'mv1-alice', name: 'Alice' }],
      recordId: 'record-id',
      shouldReencrypt: true
    });
  });

  it('reads old public-key-derived GCM2 contacts as read-only compatibility data', async () => {
    const accountDataKey = await deriveSharedAccountDataKey(PUBLIC_KEY);
    const encryptedValue = await encryptCurrentPayload(
      GROUPED_CONTACTS,
      accountDataKey,
      undefined,
      CONTACTS_LEGACY_GCM_ENCRYPTION_VERSION
    );
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    await expect(
      fetchContactsRecord({
        contactsKey: CONTACTS_KEY,
        legacyPublicKey: PUBLIC_KEY,
        authContext: AUTH_CONTEXT
      })
    ).resolves.toMatchObject({
      contacts: [{ address: 'mv1-alice', name: 'Alice' }],
      recordId: 'record-id',
      shouldReencrypt: true
    });
  });

  it('throws for unreadable GCM2 contacts instead of recovering with an empty book', async () => {
    const accountDataKey = await generateAccountDataKey();
    const encryptedValue = await encryptCurrentPayload(
      GROUPED_CONTACTS,
      accountDataKey,
      undefined,
      CONTACTS_LEGACY_GCM_ENCRYPTION_VERSION
    );
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    await expect(
      fetchContactsRecord({
        contactsKey: CONTACTS_KEY,
        authContext: AUTH_CONTEXT
      })
    ).rejects.toThrow('Unable to decrypt current contacts record');
  });

  it('treats unsupported contacts encryption versions as explicit decryption failures', async () => {
    const encryptedValue = await encryptCurrentPayload(
      GROUPED_CONTACTS,
      CONTACTS_KEY.key,
      CONTACTS_KEY.bookAddr,
      'AES-256-GCM-4'
    );
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    await expect(
      fetchContactsRecord({
        contactsKey: CONTACTS_KEY,
        authContext: AUTH_CONTEXT
      })
    ).rejects.toThrow(CurrentContactsRecordDecryptionError);
    await expect(
      fetchContactsRecord({
        contactsKey: CONTACTS_KEY,
        authContext: AUTH_CONTEXT
      })
    ).rejects.toThrow('Unsupported contacts encryption version: AES-256-GCM-4');
  });

  it('keeps legacy v1 public-key encrypted contacts readable and marks them for re-encryption', async () => {
    const encryptedValue = await encryptLegacyPayload(GROUPED_CONTACTS, PUBLIC_KEY);
    const adapter = jest.fn(async (config: AxiosRequestConfig) => createResponse(config, buildRecord(encryptedValue)));

    mavrykApi.defaults.adapter = adapter;

    const fetched = await fetchContactsRecord({
      contactsKey: CONTACTS_KEY,
      legacyPublicKey: PUBLIC_KEY,
      authContext: AUTH_CONTEXT
    });

    expect(fetched.contacts).toEqual([{ address: 'mv1-alice', name: 'Alice' }]);
    expect(fetched.recordId).toBe('record-id');
    expect(fetched.typesByAddress).toEqual({
      'mv1-alice': 'user'
    });
    expect(fetched.shouldReencrypt).toBe(true);
  });

  it('rewrites a fetched legacy v1 contacts record as current AES-GCM on save', async () => {
    const encryptedLegacyValue = await encryptLegacyPayload(GROUPED_CONTACTS, PUBLIC_KEY);
    const savedEncryptedValues: EncryptedValue[] = [];
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      const requestConfig = config as MavrykApiRequestConfig;

      if (requestConfig.method === 'get') {
        return createResponse(config, buildRecord(encryptedLegacyValue));
      }

      if (requestConfig.method === 'put' && requestConfig.url === '/account/data/record-id') {
        const body = parseAdapterData(requestConfig.data) as {
          encryptedValue: EncryptedValue;
        };

        savedEncryptedValues.push(body.encryptedValue);

        return createResponse(config, buildRecord(body.encryptedValue));
      }

      throw new Error(`Unexpected request: ${requestConfig.method} ${requestConfig.url}`);
    });

    mavrykApi.defaults.adapter = adapter;

    const fetched = await fetchContactsRecord({
      contactsKey: CONTACTS_KEY,
      legacyPublicKey: PUBLIC_KEY,
      authContext: AUTH_CONTEXT
    });
    const saved = await saveContactsRecord({
      contactsKey: CONTACTS_KEY,
      contacts: [{ address: 'mv1-bob', name: 'Bob' }, ...fetched.contacts],
      recordId: fetched.recordId,
      typesByAddress: fetched.typesByAddress,
      authContext: AUTH_CONTEXT
    });

    expect(savedEncryptedValues[0]?.version).toBe(CONTACTS_ENCRYPTION_VERSION);
    expect(base64ToBytes(savedEncryptedValues[0]?.iv ?? '')).toHaveLength(12);
    expect(saved).toMatchObject({
      contacts: [
        { address: 'mv1-bob', name: 'Bob' },
        { address: 'mv1-alice', name: 'Alice' }
      ],
      recordId: 'record-id'
    });
  });

  it('deletes a contacts record by id', async () => {
    const calls: MavrykApiRequestConfig[] = [];
    const adapter = jest.fn(async (config: AxiosRequestConfig) => {
      calls.push(config as MavrykApiRequestConfig);

      return createResponse(config, {});
    });

    mavrykApi.defaults.adapter = adapter;

    await deleteContactsRecord('record-id', AUTH_CONTEXT);

    expect(calls.map(({ method, url, _authContext }) => ({ method, url, _authContext }))).toEqual([
      {
        method: 'delete',
        url: '/account/data/record-id',
        _authContext: AUTH_CONTEXT
      }
    ]);
  });
});
