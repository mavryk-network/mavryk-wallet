export const CONTACTS_DATA_KEY = 'contacts';
export const CONTACTS_DATA_TYPE = 'contacts';
export const CONTACTS_LEGACY_ENCRYPTION_VERSION = 'AES-256-CBC-1';
export const CONTACTS_ENCRYPTION_VERSION = 'AES-256-GCM-2';
export const CONTACTS_ENCRYPTION_INFO = [
  'mavryk-wallet',
  CONTACTS_DATA_TYPE,
  CONTACTS_DATA_KEY,
  CONTACTS_ENCRYPTION_VERSION
].join('|');

export const CONTACTS_KEY_BYTES = 32;

const encoder = new TextEncoder();
const BASE64_CHUNK_SIZE = 0x8000;

export type ContactsCurrentKey = {
  key: string;
  bookAddr: string;
};

export function buildContactsAad(bookAddr: string) {
  return encoder.encode([bookAddr, CONTACTS_DATA_TYPE, CONTACTS_DATA_KEY, CONTACTS_ENCRYPTION_VERSION].join('|'));
}

export function bytesToBase64(bytes: Uint8Array) {
  if (typeof btoa === 'function') {
    let binary = '';

    for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
      binary += String.fromCharCode(...Array.from(bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)));
    }

    return btoa(binary);
  }

  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(value: string) {
  if (typeof atob === 'function') {
    return Uint8Array.from(atob(value), char => char.charCodeAt(0));
  }

  return Uint8Array.from(Buffer.from(value, 'base64'));
}
