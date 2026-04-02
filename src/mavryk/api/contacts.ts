import axios from 'axios';
import { z } from 'zod';

import type { TempleContact, TempleContactApiType } from 'lib/temple/types';

import { mavrykApi } from './client';
import { extractMavrykApiErrorMessage } from './errors';

const CONTACTS_DATA_KEY = 'contacts';
const CONTACTS_DATA_TYPE = 'contacts';
const CONTACTS_API_TYPES = ['user', 'validator', 'contract'] as const;
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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function deriveAccountDataKey(publicKey: string): Promise<CryptoKey> {
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
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
    timestamp: Date.now(),
    version: 'AES-256-CBC-1'
  };
}

async function decryptValueFromBackend(encrypted: EncryptedValue, key: CryptoKey): Promise<string> {
  const iv = Uint8Array.from(atob(encrypted.iv), char => char.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(encrypted.ciphertext), char => char.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);

  return decoder.decode(decrypted);
}

async function decryptContactsRecord(
  record: AccountDataRecord,
  key: CryptoKey
): Promise<{ contacts: TempleContact[]; typesByAddress: Record<string, TempleContactApiType> }> {
  const decrypted = await decryptValueFromBackend(record.encryptedValue, key);
  return normalizeDecryptedPayload(ContactsPayloadSchema.parse(JSON.parse(decrypted)));
}

async function parseContactsResponse(
  data: unknown,
  key: CryptoKey
): Promise<{
  contacts: TempleContact[];
  record: AccountDataRecord;
  typesByAddress: Record<string, TempleContactApiType>;
}> {
  const record = AccountDataRecordSchema.parse(data);
  const { contacts, typesByAddress } = await decryptContactsRecord(record, key);

  return { contacts, record, typesByAddress };
}

export async function fetchContactsRecord(publicKey: string): Promise<{
  contacts: TempleContact[];
  recordId: string | null;
  typesByAddress?: Record<string, TempleContactApiType>;
}> {
  try {
    const key = await deriveAccountDataKey(publicKey);
    const { data } = await mavrykApi.get(`/account/data/${CONTACTS_DATA_TYPE}/${CONTACTS_DATA_KEY}`, {
      params: {
        limit: 100
      }
    });

    const parsed = await parseContactsResponse(data, key);

    return {
      contacts: parsed.contacts,
      recordId: parsed.record.id,
      typesByAddress: parsed.typesByAddress
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return { contacts: [], recordId: null };
    }
    throw new Error(extractMavrykApiErrorMessage(error));
  }
}

export async function saveContactsRecord(params: {
  contacts: TempleContact[];
  publicKey: string;
  recordId?: string | null;
  typesByAddress?: Record<string, TempleContactApiType>;
}): Promise<{
  contacts: TempleContact[];
  recordId: string;
  typesByAddress: Record<string, TempleContactApiType>;
}> {
  try {
    const key = await deriveAccountDataKey(params.publicKey);
    const encryptedValue = await encryptValueForBackend(
      buildGroupedPayload(params.contacts, params.typesByAddress),
      key
    );
    const response = params.recordId
      ? await mavrykApi.put(`/account/data/${params.recordId}`, { encryptedValue })
      : await mavrykApi.post('/account/data', {
          dataType: CONTACTS_DATA_TYPE,
          dataKey: CONTACTS_DATA_KEY,
          encryptedValue
        });

    const parsed = await parseContactsResponse(response.data, key);

    return {
      contacts: parsed.contacts,
      recordId: parsed.record.id,
      typesByAddress: parsed.typesByAddress
    };
  } catch (error) {
    throw new Error(extractMavrykApiErrorMessage(error));
  }
}
