import { ASSETS_MIGRATION_NAME, migrateFromIndexedDB } from 'lib/assets/migrations';
import { updateOwnedUI } from 'lib/store/zustand/ui-client';

import { migrate } from './migrator';

jest.mock('lib/store/zustand/ui-client', () => ({ updateOwnedUI: jest.fn(async () => undefined) }));
const old = { name: 'assets-migrations@1.18.2', dateApplied: '2020-01-01T00:00:00.000Z' };

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  let queue: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (_name: string, callback: () => Promise<void>) => {
        const result = queue.then(callback);
        queue = result.catch(() => undefined);
        return result;
      }
    }
  });
});
afterEach(() => jest.restoreAllMocks());

it('runs the new registration despite 1.18.2 history and preserves existing entries on two reloads', async () => {
  localStorage.setItem('MIGRATIONS', JSON.stringify([old]));
  for (let i = 0; i < 3; i++) await migrate([{ name: ASSETS_MIGRATION_NAME, up: migrateFromIndexedDB }]);
  expect(updateOwnedUI).toHaveBeenCalledTimes(1);
  expect(updateOwnedUI).toHaveBeenCalledWith({ kind: 'indexeddb-assets-migration' });
  expect(JSON.parse(localStorage.getItem('MIGRATIONS')!)).toEqual([
    old,
    { name: 'assets-migrations@3.0.0', dateApplied: expect.any(String) }
  ]);
});

it('records earlier success even if a later migration fails and retries only unfinished work', async () => {
  const first = jest.fn();
  const second = jest.fn().mockRejectedValueOnce(new Error('later')).mockResolvedValueOnce(undefined);
  const migrations = [
    { name: 'first', up: first },
    { name: 'second', up: second }
  ];
  await expect(migrate(migrations)).rejects.toThrow('later');
  expect(JSON.parse(localStorage.getItem('MIGRATIONS')!)[0].name).toBe('first');
  await migrate(migrations);
  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(2);
});

it.each(['null', '{}', '', '[{"name":"old","dateApplied":"bad"}]', '{bad'])(
  'rejects malformed history without running or replacing it: %s',
  async raw => {
    localStorage.setItem('MIGRATIONS', raw);
    const up = jest.fn();
    await expect(migrate([{ name: 'new', up }])).rejects.toThrow();
    expect(up).not.toHaveBeenCalled();
    expect(localStorage.getItem('MIGRATIONS')).toBe(raw);
  }
);

it('preserves history on read/write failures and recovers interruption after durable owner completion', async () => {
  localStorage.setItem('MIGRATIONS', JSON.stringify([old]));
  const up = jest.fn(async () => undefined);
  const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
    throw new Error('read');
  });
  await expect(migrate([{ name: 'new', up }])).rejects.toThrow('read');
  expect(up).not.toHaveBeenCalled();
  get.mockRestore();
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
    throw new Error('write');
  });
  await expect(migrate([{ name: 'new', up }])).rejects.toThrow('write');
  expect(JSON.parse(localStorage.getItem('MIGRATIONS')!)).toEqual([old]);
  set.mockRestore();
  await migrate([{ name: 'new', up }]);
  expect(up).toHaveBeenCalledTimes(2);
});

it('serializes concurrent contexts and retains unrelated history added during the owner await', async () => {
  const up = jest.fn(async () => {
    localStorage.setItem('MIGRATIONS', JSON.stringify([old]));
  });
  await Promise.all([migrate([{ name: 'new', up }]), migrate([{ name: 'new', up }])]);
  expect(up).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem('MIGRATIONS')!)).toHaveLength(2);
});

it('rejects lost owner acknowledgement without marking completion and detects failed history read-back', async () => {
  const up = jest.fn().mockRejectedValueOnce(new Error('lost ack'));
  await expect(migrate([{ name: 'new', up }])).rejects.toThrow('lost ack');
  expect(localStorage.getItem('MIGRATIONS')).toBeNull();
  const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => undefined);
  await expect(migrate([{ name: 'new', up: jest.fn() }])).rejects.toThrow('verification');
  set.mockRestore();
});

it('fails closed without cross-context locking support', async () => {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  const up = jest.fn();
  await expect(migrate([{ name: 'new', up }])).rejects.toThrow('coordination unavailable');
  expect(up).not.toHaveBeenCalled();
});
