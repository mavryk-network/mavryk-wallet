import axios from 'axios';
import { z } from 'zod';

import type { TempleContact, TempleContactApiType } from 'lib/temple/types';

import { mavrykApi } from './client';
import type { MavrykApiRequestConfig } from './client';
import { extractMavrykApiErrorMessage } from './errors';
import type { ResolvedMavrykAuthStorageContext } from './storage';

const CONTACTS_DATA_KEY = 'contacts';
const CONTACTS_DATA_TYPE = 'contacts';
const CONTACTS_API_TYPES = ['user', 'validator', 'contract'] as const;
const CONTACTS_LEGACY_ENCRYPTION_VERSION = 'AES-256-CBC-1';
const CONTACTS_ENCRYPTION_VERSION = 'AES-256-GCM-2';
// Version -> cipher/key source:
// AES-256-CBC-1 -> AES-CBC with the legacy PBKDF2(publicKey) key. Read only.
// AES-256-GCM-2 -> AES-GCM with accountDataKey. New writes use the shared public-key-derived key when available.
const ACCOUNT_DATA_KEY_BYTES = 32;
const AES_GCM_IV_BYTES = 12;
const BASE64_CHUNK_SIZE = 0x8000;
const NumberLikeSchema = z.union([z.number(), z.string()]).pipe(z.coerce.number());

const EncryptedValueSchema = z.object({
  ciphertext: z.string(),
  iv: z.string(),
  timestamp: NumberLikeSchema,
  version: z.string()
});

const ContactsPayloadTypeSchema = z.enum(CONTACTS_API_TYPES);

const ContactsPayloadItemSchema = z.object({
  address: z.string(),
  name: z.string(),
  addedAt: NumberLikeSchema.optional(),
  type: ContactsPayloadTypeSchema.optional()
});

const FlatContactsPayloadSchema = z.array(ContactsPayloadItemSchema);
const GroupedContactsPayloadSchema = z.object({
  user: z.array(ContactsPayloadItemSchema),
  validator: z.array(ContactsPayloadItemSchema),
  contract: z.array(ContactsPayloadItemSchema)
});
const ContactsPayloadSchema = z.union([FlatContactsPayloadSchema, GroupedContactsPayloadSchema]);

const AccountDataRecordSchema = z.object({
  accountId: z.string(),
  createdAt: z.string(),
  dataKey: z.string(),
  dataType: z.string(),
  encryptedValue: EncryptedValueSchema,
  id: z.string(),
  updatedAt: z.string(),
  version: NumberLikeSchema.optional()
});

type EncryptedValue = z.infer<typeof EncryptedValueSchema>;
type GroupedContactsPayload = z.infer<typeof GroupedContactsPayloadSchema>;
type AccountDataRecord = z.infer<typeof AccountDataRecordSchema>;
type ContactsPayloadItem = z.infer<typeof ContactsPayloadItemSchema>;
type DecryptedContactsRecord = {
  accountDataKey?: string;
  contacts: TempleContact[];
  typesByAddress: Record<string, TempleContactApiType>;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class CurrentContactsRecordDecryptionError extends Error {
  shouldGenerateAccountDataKey: boolean;

  constructor(message: string, shouldGenerateAccountDataKey: boolean) {
    super(message);
    this.name = 'CurrentContactsRecordDecryptionError';
    this.shouldGenerateAccountDataKey = shouldGenerateAccountDataKey;
    Object.setPrototypeOf(this, CurrentContactsRecordDecryptionError.prototype);
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)));
  }

  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

async function generateAccountDataKey() {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const rawKey = await crypto.subtle.exportKey('raw', key);

  return bytesToBase64(new Uint8Array(rawKey));
}

async function importAccountDataKey(accountDataKey: string): Promise<CryptoKey> {
  const rawKey = base64ToBytes(accountDataKey);

  if (rawKey.length !== ACCOUNT_DATA_KEY_BYTES) {
    throw new Error('Invalid contacts encryption key');
  }

  return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function deriveLegacyCbcKey(publicKey: string): Promise<CryptoKey> {
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
    ACCOUNT_DATA_KEY_BYTES * 8
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

function toTempleContact(item: ContactsPayloadItem): TempleContact {
  return typeof item.addedAt === 'number'
    ? { address: item.address, name: item.name, addedAt: item.addedAt }
    : { address: item.address, name: item.name };
}

function flattenGroupedPayload(payload: GroupedContactsPayload): {
  contacts: TempleContact[];
  typesByAddress: Record<string, TempleContactApiType>;
} {
  return CONTACTS_API_TYPES.reduce<{
    contacts: TempleContact[];
    typesByAddress: Record<string, TempleContactApiType>;
  }>(
    (acc, type) => {
      payload[type].forEach(item => {
        acc.contacts.push(toTempleContact(item));
        acc.typesByAddress[item.address] = item.type ?? type;
      });

      return acc;
    },
    { contacts: [], typesByAddress: {} }
  );
}

function normalizeDecryptedPayload(payload: z.infer<typeof ContactsPayloadSchema>) {
  if (Array.isArray(payload)) {
    return payload.reduce<{
      contacts: TempleContact[];
      typesByAddress: Record<string, TempleContactApiType>;
    }>(
      (acc, item) => {
        acc.contacts.push(toTempleContact(item));
        acc.typesByAddress[item.address] = item.type ?? 'user';
        return acc;
      },
      { contacts: [], typesByAddress: {} }
    );
  }

  return flattenGroupedPayload(payload);
}

function buildGroupedPayload(
  contacts: TempleContact[],
  typesByAddress?: Record<string, TempleContactApiType>
): GroupedContactsPayload {
  return contacts.reduce<GroupedContactsPayload>(
    (acc, contact) => {
      const type = typesByAddress?.[contact.address] ?? 'user';
      acc[type].push({
        address: contact.address,
        name: contact.name,
        ...(typeof contact.addedAt === 'number' ? { addedAt: contact.addedAt } : {}),
        type
      });
      return acc;
    },
    {
      user: [],
      validator: [],
      contract: []
    }
  );
}

async function encryptValueForBackend(data: GroupedContactsPayload, key: CryptoKey): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
    timestamp: Date.now(),
    version: CONTACTS_ENCRYPTION_VERSION
  };
}

async function decryptCurrentValueFromBackend(encrypted: EncryptedValue, key: CryptoKey): Promise<string> {
  const iv = base64ToBytes(encrypted.iv);
  const ciphertext = base64ToBytes(encrypted.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

  return decoder.decode(decrypted);
}

async function decryptLegacyValueFromBackend(encrypted: EncryptedValue, key: CryptoKey): Promise<string> {
  const iv = base64ToBytes(encrypted.iv);
  const ciphertext = base64ToBytes(encrypted.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);

  return decoder.decode(decrypted);
}

async function decryptContactsRecord(
  record: AccountDataRecord,
  params: { accountDataKey?: string | null; publicKey?: string | null }
): Promise<DecryptedContactsRecord> {
  let decrypted: string | null = null;
  let accountDataKey: string | undefined;

  if (record.encryptedValue.version === CONTACTS_ENCRYPTION_VERSION) {
    const sharedAccountDataKey = params.publicKey ? await deriveSharedAccountDataKey(params.publicKey) : null;
    const accountDataKeyCandidates = [params.accountDataKey, sharedAccountDataKey].filter(
      (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
    );

    if (accountDataKeyCandidates.length === 0) {
      throw new CurrentContactsRecordDecryptionError('Missing local contacts encryption key', true);
    }

    let decryptError: unknown;

    for (const candidate of accountDataKeyCandidates) {
      try {
        decrypted = await decryptCurrentValueFromBackend(record.encryptedValue, await importAccountDataKey(candidate));
        accountDataKey = candidate;
        break;
      } catch (error) {
        decryptError = error;
      }
    }

    if (!decrypted) {
      const shouldGenerateAccountDataKey =
        !sharedAccountDataKey &&
        decryptError instanceof Error &&
        decryptError.message === 'Invalid contacts encryption key';
      const errorMessage = extractMavrykApiErrorMessage(decryptError);

      throw new CurrentContactsRecordDecryptionError(
        errorMessage === 'Mavryk API request failed' ? 'Unable to decrypt current contacts record' : errorMessage,
        shouldGenerateAccountDataKey
      );
    }
  } else if (record.encryptedValue.version === CONTACTS_LEGACY_ENCRYPTION_VERSION) {
    if (!params.publicKey) {
      throw new Error('Missing public key for legacy contacts decryption');
    }

    decrypted = await decryptLegacyValueFromBackend(record.encryptedValue, await deriveLegacyCbcKey(params.publicKey));
    accountDataKey = await deriveSharedAccountDataKey(params.publicKey);
  } else {
    throw new Error(`Unsupported contacts encryption version: ${record.encryptedValue.version}`);
  }

  if (!decrypted) {
    throw new Error('Failed to decrypt contacts record');
  }

  return {
    ...(accountDataKey ? { accountDataKey } : {}),
    ...normalizeDecryptedPayload(ContactsPayloadSchema.parse(JSON.parse(decrypted)))
  };
}

async function parseContactsResponse(
  data: unknown,
  params: { accountDataKey?: string | null; publicKey?: string | null }
): Promise<{
  accountDataKey?: string;
  contacts: TempleContact[];
  record: AccountDataRecord;
  typesByAddress: Record<string, TempleContactApiType>;
}> {
  const record = AccountDataRecordSchema.parse(data);
  const decrypted = await decryptContactsRecord(record, params);

  return { ...decrypted, record };
}

async function buildUnreadableCurrentContactsRecovery(
  record: AccountDataRecord,
  error: CurrentContactsRecordDecryptionError,
  accountDataKey?: string | null,
  publicKey?: string | null
) {
  const sharedAccountDataKey = publicKey ? await deriveSharedAccountDataKey(publicKey) : null;
  const canReuseAccountDataKey = accountDataKey ? await isValidAccountDataKey(accountDataKey) : false;
  const shouldGenerateAccountDataKey =
    !sharedAccountDataKey && (error.shouldGenerateAccountDataKey || !canReuseAccountDataKey);
  const nextAccountDataKey = shouldGenerateAccountDataKey
    ? await generateAccountDataKey()
    : sharedAccountDataKey ?? accountDataKey!;

  return {
    accountDataKey: nextAccountDataKey,
    contacts: [],
    recordId: record.id
  };
}

async function isValidAccountDataKey(accountDataKey: string) {
  try {
    await importAccountDataKey(accountDataKey);
    return true;
  } catch {
    return false;
  }
}

function isNotFoundError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function isConflictError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 409;
}

function buildContactsRecordRequest(encryptedValue: EncryptedValue) {
  return {
    dataType: CONTACTS_DATA_TYPE,
    dataKey: CONTACTS_DATA_KEY,
    encryptedValue
  };
}

async function fetchEncryptedContactsRecord(requestConfig: MavrykApiRequestConfig) {
  const { data } = await mavrykApi.get(`/account/data/${CONTACTS_DATA_TYPE}/${CONTACTS_DATA_KEY}`, {
    ...requestConfig,
    params: {
      ...requestConfig.params,
      limit: 100
    }
  });

  return AccountDataRecordSchema.parse(data);
}

async function createContactsRecord(encryptedValue: EncryptedValue, requestConfig: MavrykApiRequestConfig) {
  return mavrykApi.post('/account/data', buildContactsRecordRequest(encryptedValue), requestConfig);
}

async function updateContactsRecord(
  encryptedValue: EncryptedValue,
  recordId: string,
  requestConfig: MavrykApiRequestConfig
) {
  return mavrykApi.put(`/account/data/${recordId}`, { encryptedValue }, requestConfig);
}

async function createOrUpdateExistingContactsRecord(
  encryptedValue: EncryptedValue,
  requestConfig: MavrykApiRequestConfig
) {
  try {
    return await createContactsRecord(encryptedValue, requestConfig);
  } catch (error) {
    if (!isConflictError(error)) {
      throw error;
    }

    const existingRecord = await fetchEncryptedContactsRecord(requestConfig);

    return updateContactsRecord(encryptedValue, existingRecord.id, requestConfig);
  }
}

async function saveEncryptedContactsRecord(
  encryptedValue: EncryptedValue,
  recordId: string | null | undefined,
  requestConfig: MavrykApiRequestConfig
) {
  if (!recordId) {
    return createOrUpdateExistingContactsRecord(encryptedValue, requestConfig);
  }

  try {
    return await updateContactsRecord(encryptedValue, recordId, requestConfig);
  } catch (error) {
    if (isNotFoundError(error)) {
      return createOrUpdateExistingContactsRecord(encryptedValue, requestConfig);
    }

    throw error;
  }
}

export async function fetchContactsRecord(params: {
  accountDataKey?: string | null;
  publicKey?: string;
  authContext?: ResolvedMavrykAuthStorageContext;
  recoverUnreadableCurrentRecord?: boolean;
}): Promise<{
  accountDataKey?: string;
  contacts: TempleContact[];
  recordId: string | null;
  typesByAddress?: Record<string, TempleContactApiType>;
}> {
  try {
    const requestConfig: MavrykApiRequestConfig = {
      params: {
        limit: 100
      },
      ...(params.authContext ? { _authContext: params.authContext } : {})
    };
    const record = await fetchEncryptedContactsRecord(requestConfig);
    let decrypted: Awaited<ReturnType<typeof decryptContactsRecord>>;

    try {
      decrypted = await decryptContactsRecord(record, params);
    } catch (error) {
      if (params.recoverUnreadableCurrentRecord && error instanceof CurrentContactsRecordDecryptionError) {
        return buildUnreadableCurrentContactsRecovery(record, error, params.accountDataKey, params.publicKey);
      }

      throw error;
    }

    const accountDataKey =
      record.encryptedValue.version === CONTACTS_LEGACY_ENCRYPTION_VERSION
        ? decrypted.accountDataKey ?? params.accountDataKey ?? (await generateAccountDataKey())
        : decrypted.accountDataKey ?? params.accountDataKey ?? undefined;

    return {
      ...(accountDataKey ? { accountDataKey } : {}),
      contacts: decrypted.contacts,
      recordId: record.id,
      typesByAddress: decrypted.typesByAddress
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        ...(params.accountDataKey ? { accountDataKey: params.accountDataKey } : {}),
        contacts: [],
        recordId: null
      };
    }
    throw new Error(extractMavrykApiErrorMessage(error));
  }
}

export async function saveContactsRecord(params: {
  accountDataKey?: string | null;
  contacts: TempleContact[];
  publicKey?: string | null;
  recordId?: string | null;
  typesByAddress?: Record<string, TempleContactApiType>;
  authContext?: ResolvedMavrykAuthStorageContext;
}): Promise<{
  accountDataKey: string;
  contacts: TempleContact[];
  recordId: string;
  typesByAddress: Record<string, TempleContactApiType>;
}> {
  try {
    const accountDataKey = params.publicKey
      ? await deriveSharedAccountDataKey(params.publicKey)
      : params.accountDataKey ?? (await generateAccountDataKey());
    const key = await importAccountDataKey(accountDataKey);
    const encryptedValue = await encryptValueForBackend(
      buildGroupedPayload(params.contacts, params.typesByAddress),
      key
    );
    const requestConfig: MavrykApiRequestConfig = params.authContext ? { _authContext: params.authContext } : {};
    const response = await saveEncryptedContactsRecord(encryptedValue, params.recordId, requestConfig);

    const parsed = await parseContactsResponse(response.data, { accountDataKey, publicKey: params.publicKey });

    return {
      accountDataKey: parsed.accountDataKey ?? accountDataKey,
      contacts: parsed.contacts,
      recordId: parsed.record.id,
      typesByAddress: parsed.typesByAddress
    };
  } catch (error) {
    throw new Error(extractMavrykApiErrorMessage(error));
  }
}
