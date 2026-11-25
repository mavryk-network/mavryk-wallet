const DB_NAME = 'TempleVaultSessionWrappingKeys';
const DB_VERSION = 1;
const STORE_NAME = 'sessionWrappingKeys';

export type VaultSessionWrappingKeyRecord = {
  id: string;
  createdAt: number;
  expiresAt: number;
  key: CryptoKey;
};

const memoryRecords = new Map<string, VaultSessionWrappingKeyRecord>();

export async function saveSessionWrappingKey(record: VaultSessionWrappingKeyRecord) {
  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    if (isTestEnv()) {
      memoryRecords.set(record.id, record);
      return;
    }

    throw new Error('IndexedDB is unavailable for vault session wrapping keys');
  }

  await runRequest('readwrite', store => store.put(record));
}

export async function getSessionWrappingKey(id: string) {
  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    return isTestEnv() ? memoryRecords.get(id)?.key : undefined;
  }

  const record = await runRequest<VaultSessionWrappingKeyRecord | undefined>('readonly', store => store.get(id));
  return record?.key;
}

export async function deleteSessionWrappingKey(id: string) {
  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    if (isTestEnv()) memoryRecords.delete(id);
    return;
  }

  await runRequest('readwrite', store => store.delete(id));
}

export async function clearSessionWrappingKeys() {
  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    if (isTestEnv()) memoryRecords.clear();
    return;
  }

  await runRequest('readwrite', store => store.clear());
}

export async function clearExpiredSessionWrappingKeys(now = Date.now()) {
  const indexedDb = getIndexedDb();
  if (!indexedDb) {
    if (isTestEnv()) {
      for (const [id, record] of memoryRecords) {
        if (record.expiresAt <= now) memoryRecords.delete(id);
      }
    }
    return;
  }

  const records = await runRequest<VaultSessionWrappingKeyRecord[]>('readonly', store => store.getAll());
  const expiredIds = records.filter(record => record.expiresAt <= now).map(record => record.id);

  await Promise.all(expiredIds.map(deleteSessionWrappingKey));
}

function getIndexedDb() {
  if (typeof indexedDB !== 'undefined') return indexedDB;
  return undefined;
}

function isTestEnv() {
  return process.env.NODE_ENV === 'test';
}

function openDb(factory: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onerror = () => reject(request.error ?? new Error('Failed to open vault session wrapping key store'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  buildRequest: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const indexedDb = getIndexedDb();
  if (!indexedDb) throw new Error('IndexedDB is unavailable for vault session wrapping keys');

  const db = await openDb(indexedDb);

  return new Promise<T>((resolve, reject) => {
    let result: T;
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      db.close();
      fn();
    };
    const fail = (error: unknown) => settle(() => reject(error));
    const transaction = db.transaction(STORE_NAME, mode);
    const request = buildRequest(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => fail(request.error ?? new Error('Vault session wrapping key store request failed'));
    transaction.onerror = () =>
      fail(transaction.error ?? new Error('Vault session wrapping key store transaction failed'));
    transaction.onabort = () =>
      fail(transaction.error ?? new Error('Vault session wrapping key store transaction aborted'));
    transaction.oncomplete = () => settle(() => resolve(result));
  });
}
