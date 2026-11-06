import { createAssetsStore } from '../assets.store';
import { awaitStoresHydrated } from '../await-stores-hydrated';
import { createSecurityMigration } from '../security-migration';
import { memoryStorage } from '../test-support/helpers';

const source = (slug: string) => ({ mainnetWhitelist: { data: [slug] }, mainnetScamlist: { data: { [slug]: true } } });
async function setup(initial: Record<string, unknown> = {}) {
  const memory = memoryStorage(initial);
  const assets = createAssetsStore(memory.storage);
  await awaitStoresHydrated(assets);
  // Task 13 creates the destination before this independent adoption runs.
  if (!(await assets.persistence.readBack())) {
    assets.persistence.prepare(() => undefined).commit();
    await assets.persistence.flush();
  }
  const readFallback = jest.fn(async (_key: string): Promise<string | null> => null);
  const migration = createSecurityMigration({ assets, storage: memory.storage, readFallback });
  return { ...memory, assets, readFallback, migration };
}

it('prefers active sources, preserves user records and retained sources, then never replays after restart', async () => {
  const sources = { 'persist:temple-root-task11': { assets: source('active') }, 'persist:root.assets': source('old') };
  const s = await setup(sources);
  s.assets
    .getState()
    .putTokensAsIs([{ account: 'alice', chainId: 'chain', slug: 'manual', status: 'removed', manual: true }]);
  await s.migration.initialize();
  expect(s.assets.getState().mainnetScamlist).toEqual({ active: true });
  expect(s.assets.getState().isSecurityAdopted).toBe(true);
  expect(s.assets.getState().tokens['alice@chain'].manual).toEqual({ status: 'removed', manual: true });
  for (const [key, value] of Object.entries(sources)) expect(s.records[key]).toEqual(value);
  s.assets.persistence
    .prepare(draft => {
      draft.mainnetScamlist = { newer: true };
    })
    .commit();
  await s.assets.persistence.flush();
  const restart = await setup({ ...s.records, 'persist:temple-root-task11': 'malformed' });
  await restart.migration.initialize();
  expect(restart.assets.getState().mainnetScamlist).toEqual({ newer: true });
  expect(restart.readFallback).not.toHaveBeenCalled();
});

it('adopts serialized historical fallback only after successful absent reads', async () => {
  const s = await setup();
  s.readFallback.mockImplementation(async key =>
    key === 'persist:root.assets' ? JSON.stringify(source('historical')) : null
  );
  await s.migration.initialize();
  expect(s.assets.getState().mainnetScamlist).toEqual({ historical: true });
});

it.each([undefined, { mainnetWhitelist: { data: [] }, mainnetScamlist: { data: {} } }])(
  'keeps absent/default empty legacy security unknown while completing adoption',
  async raw => {
    const s = await setup(raw === undefined ? {} : { 'persist:root.assets': raw });
    await s.migration.initialize();
    expect(s.assets.getState()).toMatchObject({
      isSecurityAdopted: true,
      mainnetWhitelist: null,
      mainnetScamlist: null
    });
  }
);

it.each(['read', 'malformed', 'write', 'readback'])(
  'retains sources and retries after %s failure without false readiness',
  async failure => {
    const s = await setup({ 'persist:root.assets': source('cached') });
    const originalGet = s.storage.get;
    if (failure === 'read') (s.storage.get as jest.Mock).mockRejectedValueOnce(new Error('read'));
    if (failure === 'malformed') s.records['persist:root.assets'] = { mainnetScamlist: { data: [] } };
    if (failure === 'write') (s.storage.set as jest.Mock).mockRejectedValueOnce(new Error('write'));
    if (failure === 'readback') {
      let reads = 0;
      (s.storage.get as jest.Mock).mockImplementation(async key => {
        if (key === 'zustand-assets' && ++reads === 2) throw new Error('readback');
        return { [key]: s.records[key] };
      });
    }
    await expect(s.migration.initialize()).rejects.toThrow();
    expect(s.migration.isReady()).toBe(false);
    expect(s.records['persist:root.assets']).toBeDefined();
    s.records['persist:root.assets'] = source('cached');
    (originalGet as jest.Mock).mockImplementation(async key => ({ [key]: s.records[key] }));
    await s.migration.initialize();
    expect(s.migration.isReady()).toBe(true);
    expect(s.assets.getState().mainnetScamlist).toEqual({ cached: true });
  }
);

it('preserves an existing destination even before this adoption marker and ignores obsolete malformed sources', async () => {
  const s = await setup({ 'persist:temple-root-task11': 'malformed' });
  s.assets.persistence
    .prepare(draft => {
      draft.mainnetScamlist = {};
      draft.mainnetWhitelist = ['destination'];
    })
    .commit();
  await s.assets.persistence.flush();
  await s.migration.initialize();
  expect(s.assets.getState()).toMatchObject({
    mainnetScamlist: {},
    mainnetWhitelist: ['destination'],
    isSecurityAdopted: true
  });
  expect(s.readFallback).not.toHaveBeenCalled();
});
