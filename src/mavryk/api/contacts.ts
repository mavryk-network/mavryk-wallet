import axios from 'axios';
import { z } from 'zod';

import {
  CONTACTS_DATA_KEY,
  CONTACTS_DATA_TYPE,
  CONTACTS_ENCRYPTION_VERSION,
  CONTACTS_KEY_BYTES,
  CONTACTS_LEGACY_GCM_ENCRYPTION_VERSION,
  CONTACTS_LEGACY_ENCRYPTION_VERSION,
  ContactsCurrentKey,
  base64ToBytes,
  buildContactsAad,
  bytesToBase64
} from 'lib/temple/contacts-crypto';
import type { TempleContact, TempleContactApiType } from 'lib/temple/types';

import { mavrykApi } from './client';
import type { MavrykApiRequestConfig } from './client';
import { extractMavrykApiErrorMessage } from './errors';
import type { ResolvedMavrykAuthStorageContext } from './storage';

const CONTACTS_API_TYPES = ['user', 'validator', 'contract'] as const;
// Version -> cipher/key source:
// AES-256-CBC-1 -> AES-CBC with the legacy PBKDF2(publicKey) key. Read only.
// AES-256-GCM-2 -> AES-GCM compatibility: PR-era derived key + AAD, then legacy keys. Read only.
// AES-256-GCM-3 -> AES-GCM with HKDF(seed/private-key) key and contacts AAD.
const AES_GCM_IV_BYTES = 12;
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
type ContactsKeyCandidate = ContactsCurrentKey & { legacy: boolean };
type LegacyGcmKeyCandidate = {
  key: string;
  bookAddr?: string;
};
type DecryptedContactsRecord = {
  contacts: TempleContact[];
  shouldReencrypt?: boolean;
  typesByAddress: Record<string, TempleContactApiType>;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class CurrentContactsRecordDecryptionError extends Error {
  constructor(message = 'Unable to decrypt current contacts record') {
    super(message);
    this.name = 'CurrentContactsRecordDecryptionError';
    Object.setPrototypeOf(this, CurrentContactsRecordDecryptionError.prototype);
  }
}

async function importAccountDataKey(accountDataKey: string): Promise<CryptoKey> {
  const rawKey = base64ToBytes(accountDataKey);

  if (rawKey.length !== CONTACTS_KEY_BYTES) {
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
    CONTACTS_KEY_BYTES * 8
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

async function encryptValueForBackend(
  data: GroupedContactsPayload,
  contactsKey: ContactsCurrentKey
): Promise<EncryptedValue> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const key = await importAccountDataKey(contactsKey.key);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: buildContactsAad(contactsKey.bookAddr) },
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

async function decryptCurrentValueFromBackend(
  encrypted: EncryptedValue,
  key: CryptoKey,
  bookAddr?: string
): Promise<string> {
  const iv = base64ToBytes(encrypted.iv);
  const ciphertext = base64ToBytes(encrypted.ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
      ...(bookAddr ? { additionalData: buildContactsAad(bookAddr, encrypted.version) } : {})
    },
    key,
    ciphertext
  );

  return decoder.decode(decrypted);
}

async function decryptLegacyValueFromBackend(encrypted: EncryptedValue, key: CryptoKey): Promise<string> {
  const iv = base64ToBytes(encrypted.iv);
  const ciphertext = base64ToBytes(encrypted.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);

  return decoder.decode(decrypted);
}

function getContactsKeyCandidates(
  contactsKey?: ContactsCurrentKey | null,
  legacyContactsKeys?: ContactsCurrentKey[] | null
) {
  return [
    contactsKey ? { ...contactsKey, legacy: false } : null,
    ...(legacyContactsKeys?.map(key => ({ ...key, legacy: true })) ?? [])
  ].filter((value, index, values): value is ContactsKeyCandidate =>
    Boolean(value && values.findIndex(item => item?.key === value.key && item?.bookAddr === value.bookAddr) === index)
  );
}

async function decryptContactsRecord(
  record: AccountDataRecord,
  params: {
    contactsKey?: ContactsCurrentKey | null;
    legacyContactsKeys?: ContactsCurrentKey[] | null;
    legacyAccountDataKey?: string | null;
    legacyPublicKey?: string | null;
  }
): Promise<DecryptedContactsRecord> {
  let decrypted: string | null = null;
  let shouldReencrypt = false;

  if (record.encryptedValue.version === CONTACTS_ENCRYPTION_VERSION) {
    const contactsKeyCandidates = getContactsKeyCandidates(params.contactsKey, params.legacyContactsKeys);

    if (contactsKeyCandidates.length === 0) {
      throw new CurrentContactsRecordDecryptionError('Missing contacts encryption key');
    }

    for (const candidate of contactsKeyCandidates) {
      try {
        decrypted = await decryptCurrentValueFromBackend(
          record.encryptedValue,
          await importAccountDataKey(candidate.key),
          candidate.bookAddr
        );
        shouldReencrypt = candidate.legacy;
        break;
      } catch {}
    }

    if (!decrypted) {
      throw new CurrentContactsRecordDecryptionError();
    }
  } else if (record.encryptedValue.version === CONTACTS_LEGACY_GCM_ENCRYPTION_VERSION) {
    const legacySharedAccountDataKey = params.legacyPublicKey
      ? await deriveSharedAccountDataKey(params.legacyPublicKey)
      : null;
    const contactsKeyCandidates = getContactsKeyCandidates(params.contactsKey, params.legacyContactsKeys);
    const mixedAccountDataKeyCandidates: Array<LegacyGcmKeyCandidate | null> = [
      ...contactsKeyCandidates,
      params.legacyAccountDataKey ? { key: params.legacyAccountDataKey, bookAddr: undefined } : null,
      legacySharedAccountDataKey ? { key: legacySharedAccountDataKey, bookAddr: undefined } : null
    ];
    const accountDataKeyCandidates = mixedAccountDataKeyCandidates.filter(
      (value, index, values): value is LegacyGcmKeyCandidate =>
        Boolean(
          value && values.findIndex(item => item?.key === value.key && item?.bookAddr === value.bookAddr) === index
        )
    );

    if (accountDataKeyCandidates.length === 0) {
      throw new CurrentContactsRecordDecryptionError('Missing legacy contacts encryption key');
    }

    let decryptError: unknown;

    for (const candidate of accountDataKeyCandidates) {
      try {
        decrypted = await decryptCurrentValueFromBackend(
          record.encryptedValue,
          await importAccountDataKey(candidate.key),
          candidate.bookAddr
        );
        shouldReencrypt = true;
        break;
      } catch (error) {
        decryptError = error;
      }
    }

    if (!decrypted) {
      throw decryptError instanceof CurrentContactsRecordDecryptionError
        ? decryptError
        : new CurrentContactsRecordDecryptionError();
    }
  } else if (record.encryptedValue.version === CONTACTS_LEGACY_ENCRYPTION_VERSION) {
    if (!params.legacyPublicKey) {
      throw new CurrentContactsRecordDecryptionError('Missing public key for legacy contacts decryption');
    }

    decrypted = await decryptLegacyValueFromBackend(
      record.encryptedValue,
      await deriveLegacyCbcKey(params.legacyPublicKey)
    );
    shouldReencrypt = true;
  } else {
    throw new CurrentContactsRecordDecryptionError(
      `Unsupported contacts encryption version: ${record.encryptedValue.version}`
    );
  }

  if (!decrypted) {
    throw new Error('Failed to decrypt contacts record');
  }

  return {
    ...(shouldReencrypt ? { shouldReencrypt } : {}),
    ...normalizeDecryptedPayload(ContactsPayloadSchema.parse(JSON.parse(decrypted)))
  };
}

async function parseContactsResponse(
  data: unknown,
  params: Parameters<typeof decryptContactsRecord>[1]
): Promise<{
  contacts: TempleContact[];
  record: AccountDataRecord;
  shouldReencrypt?: boolean;
  typesByAddress: Record<string, TempleContactApiType>;
}> {
  const record = AccountDataRecordSchema.parse(data);
  const decrypted = await decryptContactsRecord(record, params);

  return { ...decrypted, record };
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

export async function deleteContactsRecord(recordId: string, authContext?: ResolvedMavrykAuthStorageContext) {
  const requestConfig: MavrykApiRequestConfig = authContext ? { _authContext: authContext } : {};

  await mavrykApi.delete(`/account/data/${recordId}`, requestConfig);
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
  contactsKey?: ContactsCurrentKey | null;
  legacyContactsKeys?: ContactsCurrentKey[] | null;
  legacyAccountDataKey?: string | null;
  legacyPublicKey?: string;
  authContext?: ResolvedMavrykAuthStorageContext;
}): Promise<{
  contacts: TempleContact[];
  encryptionVersion?: string;
  recordId: string | null;
  shouldReencrypt?: boolean;
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
    const decrypted = await decryptContactsRecord(record, params);

    return {
      contacts: decrypted.contacts,
      encryptionVersion: record.encryptedValue.version,
      recordId: record.id,
      ...(decrypted.shouldReencrypt ? { shouldReencrypt: true } : {}),
      typesByAddress: decrypted.typesByAddress
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return {
        contacts: [],
        recordId: null
      };
    }

    if (error instanceof CurrentContactsRecordDecryptionError) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      throw new Error(extractMavrykApiErrorMessage(error));
    }

    throw error;
  }
}

export async function saveContactsRecord(params: {
  contactsKey: ContactsCurrentKey;
  contacts: TempleContact[];
  recordId?: string | null;
  typesByAddress?: Record<string, TempleContactApiType>;
  authContext?: ResolvedMavrykAuthStorageContext;
}): Promise<{
  contacts: TempleContact[];
  encryptionVersion: string;
  recordId: string;
  typesByAddress: Record<string, TempleContactApiType>;
}> {
  try {
    const encryptedValue = await encryptValueForBackend(
      buildGroupedPayload(params.contacts, params.typesByAddress),
      params.contactsKey
    );
    const requestConfig: MavrykApiRequestConfig = params.authContext ? { _authContext: params.authContext } : {};
    const response = await saveEncryptedContactsRecord(encryptedValue, params.recordId, requestConfig);

    const parsed = await parseContactsResponse(response.data, { contactsKey: params.contactsKey });

    return {
      contacts: parsed.contacts,
      encryptionVersion: parsed.record.encryptedValue.version,
      recordId: parsed.record.id,
      typesByAddress: parsed.typesByAddress
    };
  } catch (error) {
    if (error instanceof CurrentContactsRecordDecryptionError) {
      throw error;
    }

    throw new Error(extractMavrykApiErrorMessage(error));
  }
}
