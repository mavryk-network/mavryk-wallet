import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

import { createAssetsStore } from 'lib/store/zustand/assets.store';
import { awaitStoresHydrated } from 'lib/store/zustand/await-stores-hydrated';
import { createMetadataStore } from 'lib/store/zustand/metadata.store';
import { deferred, memoryStorage } from 'lib/store/zustand/test-support/helpers';
import { createUIStore } from 'lib/store/zustand/ui.store';

import { IndexedDBAsset, migrateIndexedDBAssets } from './indexeddb-migration';

// Jest 27's jsdom lacks structuredClone; use the already locked polyfill for real IndexedDB cloning.
Object.assign(globalThis, { structuredClone: require('@ungap/structured-clone').default });
Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const row = (values: Partial<IndexedDBAsset> = {}): IndexedDBAsset => ({
  account: 'account-a',
  chainId: 'chain-a',
  tokenSlug: 'token_0',
  status: 1,
  addedAt: 123,
  ...values
});
const metadata = { address: 'token', id: '0', name: 'Token', symbol: 'TOK', decimals: 0 };
const databases: Dexie[] = [];
let sequence = 0;
async function setup(initial: Record<string, unknown> = {}) {
  const memory = memoryStorage(initial);
  const assets = createAssetsStore(memory.storage);
  const tokens = createMetadataStore(memory.storage);
  const ui = createUIStore(memory.storage);
  await awaitStoresHydrated(assets, tokens, ui);
  ui.persistence
    .prepare(value => {
      value.legacyMigrated = true;
      value.legacyAssetsMigrated = true;
    })
    .commit();
  assets.persistence.prepare(() => undefined).commit();
  tokens.persistence.prepare(() => undefined).commit();
  await Promise.all([assets.persistence.flush(), tokens.persistence.flush(), ui.persistence.flush()]);
  const db = new Dexie(`task14-test-${sequence++}`, { indexedDB, IDBKeyRange });
  db.version(2).stores({ accountTokens: ',[chainId+account+type],[chainId+type]', operations: '&hash' });
  db.version(3).stores({ accountTokens: ',[chainId+account],[chainId]' });
  databases.push(db);
  const table = db.table<unknown, string>('accountTokens');
  const fetchMetadata = jest.fn<Promise<typeof metadata | undefined>, [IndexedDBAsset]>(async () => undefined);
  const options = { table, assets, metadata: tokens, ui, fetchMetadata };
  return { ...memory, ...options, db, run: () => migrateIndexedDBAssets(options) };
}

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all(databases.splice(0).map(db => db.delete()));
});

it('migrates a direct pre-1.18.2 fixture with every status, exact scope and manual distinctions', async () => {
  const s = await setup();
  for (let status = 0; status < 4; status++)
    await s.table.put(
      row({ status, account: `a${status}`, chainId: `n${status}`, manual: status === 0 ? undefined : status === 1 }),
      `key${status}`
    );
  await s.db.table('operations').put({ hash: 'keep' });
  await s.run();
  for (let status = 0; status < 4; status++)
    expect(s.assets.getState().tokens[`a${status}@n${status}`].token_0).toEqual({
      status: ['idle', 'enabled', 'disabled', 'removed'][status],
      manual: status === 1
    });
  expect(await s.table.count()).toBe(0);
  expect(await s.db.table('operations').count()).toBe(1);
  expect((await s.assets.persistence.readBack())?.state.tokens).toEqual(s.assets.getState().tokens);
});

it('uses all restored metadata categories with collectible before RWA before token precedence', async () => {
  const s = await setup();
  s.metadata.getState().putTokenMetadataDirectly('plain', metadata);
  s.metadata.getState().putCollectibleMetadataDirectly('art', { ...metadata, artifactUri: 'ipfs:art' });
  s.metadata.getState().putRwaMetadataDirectly('rwa', { ...metadata, symbol: 'OCEAN' });
  s.metadata.getState().putTokenMetadataDirectly('overlap', { ...metadata, symbol: 'OCEAN' });
  s.metadata.getState().putCollectibleMetadataDirectly('overlap', { ...metadata, artifactUri: 'ipfs:art' });
  for (const slug of ['plain', 'art', 'rwa', 'overlap']) await s.table.put(row({ tokenSlug: slug }), slug);
  await s.run();
  expect(Object.keys(s.assets.getState().tokens['account-a@chain-a'])).toEqual(['plain']);
  expect(Object.keys(s.assets.getState().collectibles['account-a@chain-a'])).toEqual(['art', 'overlap']);
  expect(Object.keys(s.assets.getState().rwas['account-a@chain-a'])).toEqual(['rwa']);
  expect(s.fetchMetadata).not.toHaveBeenCalled();
});

it('fetches missing metadata per source scope and uses the explicit fallback after fetch failure', async () => {
  const s = await setup();
  s.fetchMetadata.mockResolvedValueOnce({ ...metadata, symbol: 'ocean' }).mockRejectedValueOnce(new Error('offline'));
  await s.table.put(row(), 'a');
  await s.table.put(row({ chainId: 'chain-b' }), 'b');
  await s.run();
  expect(s.fetchMetadata.mock.calls.map(([record]) => [record.account, record.chainId])).toEqual([
    ['account-a', 'chain-a'],
    ['account-a', 'chain-b']
  ]);
  expect(s.assets.getState().rwas['account-a@chain-a'].token_0.status).toBe('enabled');
  expect(s.assets.getState().tokens['account-a@chain-b'].token_0).toEqual({ status: 'enabled', manual: false });
  expect(s.metadata.getState().tokensMetadata.token_0).toBeUndefined();
});

it.each([
  { status: 4 },
  { status: 'enabled' },
  { manual: 'true' },
  { addedAt: NaN },
  { account: 'bad@scope' },
  { chainId: '__proto__' },
  { tokenSlug: 'constructor' },
  { latestBalance: 'NaN' },
  { type: 5 },
  { order: -1 },
  { extra: true },
  JSON.parse('{"constructor":{"polluted":true}}')
])('rejects malformed source before any destination writes: %j', async invalid => {
  const s = await setup();
  const value = row();
  for (const [key, field] of Object.entries(invalid))
    Object.defineProperty(value, key, { value: field, enumerable: true, configurable: true });
  await s.table.put(value, 'source');
  const before = JSON.stringify(s.records);
  await expect(s.run()).rejects.toThrow();
  expect(JSON.stringify(s.records)).toBe(before);
  expect(await s.table.count()).toBe(1);
});

it('rejects unsafe source keys, invalid fetched metadata and conflicting duplicate tuples', async () => {
  const s = await setup();
  await s.table.put(row(), '__proto__');
  await expect(s.run()).rejects.toThrow();
  await s.table.delete('__proto__');
  await s.table.put(row(), 'a');
  s.fetchMetadata.mockResolvedValueOnce({ ...metadata, decimals: NaN });
  await expect(s.run()).rejects.toThrow();
  await s.table.put(row({ status: 3 }), 'b');
  await expect(s.run()).rejects.toThrow('Conflicting');
  expect(await s.table.count()).toBe(2);
});

it('keeps destination choices across categories, flags, metadata, preferences and unrelated storage', async () => {
  const retained = {
    analytics_user_id: 'original',
    'persist:temple-root': { keep: true },
    'persist:temple-root-task11': { keep: true },
    ...Object.fromEntries(
      ['assets', 'collectibles', 'rwas', 'partnersPromotion', 'collectiblesMetadata', 'rwasMetadata'].map(key => [
        `persist:root.${key}`,
        { keep: key }
      ])
    )
  };
  const s = await setup(retained);
  s.assets.getState().putRwasAsIs([{ account: 'account-a', chainId: 'chain-a', slug: 'token_0', status: 'removed' }]);
  s.assets.getState().setCollectibleAdultFlags({ token_0: { val: true, ts: 1 } });
  await s.table.put(row({ manual: true }), 'source');
  await s.run();
  expect(s.assets.getState().rwas['account-a@chain-a'].token_0).toEqual({ status: 'removed' });
  expect(s.assets.getState().tokens['account-a@chain-a']).toBeUndefined();
  expect(s.assets.getState().collectibleAdultFlags.token_0).toEqual({ val: true, ts: 1 });
  expect(s.records).toMatchObject(retained);
  expect(s.ui.getState().isAnalyticsEnabled).toBe(false);
});

it('awaits actual adapter flush and independent read-back before deleting any source', async () => {
  const s = await setup();
  await s.table.put(row(), 'source');
  const write = deferred<void>();
  const entered = deferred<void>();
  (s.storage.set as jest.Mock).mockImplementationOnce(async items => {
    entered.resolve();
    await write.promise;
    Object.assign(s.records, items);
  });
  const run = s.run();
  await entered.promise;
  expect(await s.table.count()).toBe(1);
  write.resolve();
  await run;
  expect(await s.table.count()).toBe(0);
});

it.each(['write', 'read', 'partial', 'lost-write-ack'])(
  'retains source on destination %s failure and recovers after reload',
  async failure => {
    const s = await setup();
    await s.table.put(row(), 'source');
    if (failure === 'write') (s.storage.set as jest.Mock).mockRejectedValueOnce(new Error('write'));
    if (failure === 'read') (s.storage.get as jest.Mock).mockRejectedValueOnce(new Error('read'));
    if (failure === 'partial') (s.storage.set as jest.Mock).mockResolvedValueOnce(undefined);
    if (failure === 'lost-write-ack')
      (s.storage.set as jest.Mock).mockImplementationOnce(async items => {
        Object.assign(s.records, items);
        throw new Error('ack lost');
      });
    await expect(s.run()).rejects.toThrow();
    expect(await s.table.count()).toBe(1);
    const reload = await setup(s.records);
    await migrateIndexedDBAssets({ ...reload, table: s.table });
    expect(await s.table.count()).toBe(0);
  }
);

it('retains source after read failure and transactionally rolls back a failed deletion', async () => {
  const s = await setup();
  await s.table.put(row(), 'a');
  await s.table.put(row({ tokenSlug: 'other' }), 'b');
  const read = jest.spyOn(s.table, 'each').mockRejectedValueOnce(new Error('read'));
  await expect(s.run()).rejects.toThrow('read');
  read.mockRestore();
  const original = s.table.delete.bind(s.table);
  const remove = jest
    .spyOn(s.table, 'delete')
    .mockImplementationOnce(original)
    .mockRejectedValueOnce(new Error('delete'));
  await expect(s.run()).rejects.toThrow('delete');
  expect(await s.table.count()).toBe(2);
  remove.mockRestore();
  await s.run();
  expect(await s.table.count()).toBe(0);
});

it('preserves records added or changed while metadata is fetched and aborts cleanup', async () => {
  const s = await setup();
  await s.table.put(row(), 'source');
  s.fetchMetadata.mockImplementationOnce(async () => {
    await s.table.put(row({ status: 3 }), 'source');
    await s.table.put(row({ tokenSlug: 'added' }), 'added');
    return undefined;
  });
  await expect(s.run()).rejects.toThrow('source changed');
  expect(await s.table.get('source')).toEqual(row({ status: 3 }));
  expect(await s.table.count()).toBe(2);
});

it('recovers lost owner acknowledgement, preserves newer choices and survives two reloads without duplicates', async () => {
  const s = await setup();
  await s.table.put(row(), 'source');
  await s.run(); // Simulate page disappearance before the owner reply/history write.
  s.assets
    .getState()
    .putTokensAsIs([{ account: 'account-a', chainId: 'chain-a', slug: 'token_0', status: 'disabled', manual: true }]);
  await s.assets.persistence.flush();
  let records = s.records;
  for (let i = 0; i < 2; i++) {
    const reload = await setup(records);
    await migrateIndexedDBAssets({ ...reload, table: s.table });
    expect(reload.assets.getState().tokens['account-a@chain-a']).toEqual({
      token_0: { status: 'disabled', manual: true }
    });
    records = reload.records;
  }
});

it('requires both legacy completions and successful destination hydration even with empty source', async () => {
  const s = await setup();
  s.ui.persistence
    .prepare(value => {
      value.legacyAssetsMigrated = false;
    })
    .commit();
  await expect(s.run()).rejects.toThrow('Legacy migrations');
  await s.ui.persistence.flush();
});

it('opens an actual version-2 database upgrade and preserves historical optional fields during source comparison', async () => {
  const s = await setup();
  const old = new Dexie(s.db.name, { indexedDB, IDBKeyRange });
  old.version(2).stores({ accountTokens: ',[chainId+account+type],[chainId+type]', operations: '&hash' });
  await old
    .table('accountTokens')
    .put(row({ type: 1, latestBalance: '12.5', latestUSDBalance: '0', order: 2 }), 'old-key');
  old.close();
  await s.run();
  expect(s.db.verno).toBe(3);
  expect(await s.table.count()).toBe(0);
  expect(s.assets.getState().tokens['account-a@chain-a'].token_0).toEqual({ status: 'enabled', manual: false });
});

it('rejects incorrect persisted status/manual fields even when every destination key exists', async () => {
  const s = await setup();
  await s.table.put(row({ manual: true }), 'source');
  (s.storage.set as jest.Mock).mockImplementationOnce(async items => {
    const envelope = JSON.parse(items['zustand-assets']);
    envelope.state.tokens['account-a@chain-a'].token_0.manual = false;
    Object.assign(s.records, { 'zustand-assets': JSON.stringify(envelope) });
  });
  await expect(s.run()).rejects.toThrow('verification');
  expect(await s.table.count()).toBe(1);
});

it('rejects failed destination hydration before reading or deleting source', async () => {
  const s = await setup();
  await s.table.put(row(), 'source');
  const failed = createAssetsStore(memoryStorage({ 'zustand-assets': 'invalid' }).storage);
  await expect(migrateIndexedDBAssets({ ...s, assets: failed })).rejects.toThrow();
  expect(await s.table.count()).toBe(1);
});
