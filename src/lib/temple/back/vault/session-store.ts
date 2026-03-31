import { browser } from 'lib/browser';
import { stringToArrayBuffer } from 'lib/utils';

const PASS_HASH_STORE_KEY = '@Vault:session.passHash';
const B64_PREFIX = 'b64:';

const toBase64 = (buf: ArrayBuffer) =>
  B64_PREFIX + btoa(String.fromCharCode(...new Uint8Array(buf)));

const fromBase64 = (str: string) => {
  const binary = atob(str.slice(B64_PREFIX.length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

export const savePassHash = async (passHashBuffer: ArrayBuffer) => {
  if (browser.storage.session == null) return;

  try {
    await browser.storage.session.set({ [PASS_HASH_STORE_KEY]: toBase64(passHashBuffer) });
  } catch (error) {
    console.error('Failed to save pass hash');
  }
};

export const getPassHash = async () => {
  if (browser.storage.session == null) return;

  try {
    const { [PASS_HASH_STORE_KEY]: passHash }: { [PASS_HASH_STORE_KEY]?: string } = await browser.storage.session.get(
      PASS_HASH_STORE_KEY
    );

    if (!passHash) return;
    // b64: prefix is unambiguous — legacy values (no prefix) use old stringToArrayBuffer path
    return passHash.startsWith(B64_PREFIX) ? fromBase64(passHash) : stringToArrayBuffer(passHash);
  } catch (error) {
    console.error('Failed to get pass hash');
  }

  return;
};

export const removePassHash = async () => {
  if (browser.storage.session == null) return;

  try {
    await browser.storage.session.remove(PASS_HASH_STORE_KEY);
  } catch (error) {
    console.error(error);
  }
};
