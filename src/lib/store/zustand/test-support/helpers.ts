import { BrowserStorage } from '../persist-storage';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export function memoryStorage(initial: Record<string, unknown> = {}) {
  const records = { ...initial };
  const storage: BrowserStorage = {
    get: jest.fn(async key => (Object.prototype.hasOwnProperty.call(records, key) ? { [key]: records[key] } : {})),
    set: jest.fn(async items => {
      Object.assign(records, items);
    })
  };
  return { storage, records };
}

export const microtasks = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
