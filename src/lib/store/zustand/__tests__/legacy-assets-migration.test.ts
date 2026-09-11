import { createAssetsStore } from '../assets.store';
import { createLegacyAssetsMigration } from '../legacy-assets-migration';
import { LEGACY_ASSETS_KEYS, parseLegacyAssetsSources } from '../legacy-assets-source';
import { createLegacyUIMigration } from '../legacy-ui-migration';
import { createMetadataStore } from '../metadata.store';
import { memoryStorage, microtasks } from '../test-support/helpers';
import { createUIStore } from '../ui.store';

const metadata = { address: 'KT1example', id: '0', name: 'Offline', symbol: 'NFT', decimals: 0 };
// Sanitized code-shape fixture, matching origin/dev reducers; not extracted from an installed profile.
const fixture = {
  'persist:root.assets': {
    tokens: {
      data: {
        'alice@mainnet': {
          idle: { status: 'idle' },
          enabled: { status: 'enabled', manual: true },
          disabled: { status: 'disabled', manual: false },
          removed: { status: 'removed' }
        }
      },
      isLoading: true,
      error: 'offline'
    },
    collectibles: { data: { 'alice@testnet': { nft: { status: 'enabled', manual: false } } }, isLoading: false },
    rwas: { data: { 'bob@mainnet': { rwa: { status: 'disabled', manual: true } } }, isLoading: false },
    mainnetWhitelist: { data: ['safe'], isLoading: false },
    mainnetScamlist: { data: { scam: true }, isLoading: false }
  },
  'persist:root.collectibles': { adultFlags: { nft: { val: true, ts: 42 }, safe: { val: false, ts: 43 } } },
  'persist:root.rwas': { adultFlags: { rwa: { val: false, ts: 12 } } },
  'persist:root.partnersPromotion': {
    shouldShowPromotion: true,
    promotionHidingTimestamps: { '/home': 123 },
    promotion: { data: null }
  },
  'persist:root.collectiblesMetadata': { records: [metadata] },
  'persist:root.rwasMetadata': { records: [{ ...metadata, id: '1', name: 'RWA' }] }
};
const serialize = (value: object) =>
  JSON.stringify(Object.fromEntries(Object.entries(value).map(([key, v]) => [key, JSON.stringify(v)])));
async function session(initial: Record<string, unknown> = fixture, fallback: Record<string, string | null> = {}) {
  const memory = memoryStorage(initial);
  const ui = createUIStore(memory.storage);
  const assets = createAssetsStore(memory.storage);
  const storeMetadata = createMetadataStore(memory.storage);
  await createLegacyUIMigration({
    ui,
    metadata: storeMetadata,
    storage: memory.storage,
    readFallback: async () => null,
    generateId: () => 'stable-id'
  }).initialize();
  const readFallback = jest.fn(async (key: string) => fallback[key] ?? null);
  const migration = createLegacyAssetsMigration({
    ui,
    assets,
    metadata: storeMetadata,
    storage: memory.storage,
    readFallback
  });
  return { ...memory, ui, assets, metadata: storeMetadata, migration, readFallback };
}

it.each(['object', 'serialized', 'fallback'])(
  'migrates all six %s sources with exact durable values and two reloads',
  async format => {
    const encoded = Object.fromEntries(Object.entries(fixture).map(([key, value]) => [key, serialize(value)]));
    const s = await session(
      format === 'fallback' ? {} : format === 'serialized' ? encoded : fixture,
      format === 'fallback' ? encoded : {}
    );
    await Promise.all([s.migration.initialize(), s.migration.initialize()]);
    const data = s.assets.getState();
    expect(data.tokens).toEqual(fixture['persist:root.assets'].tokens.data);
    expect(data.collectibles).toEqual(fixture['persist:root.assets'].collectibles.data);
    expect(data.rwas).toEqual(fixture['persist:root.assets'].rwas.data);
    expect(data.collectibleAdultFlags).toEqual(fixture['persist:root.collectibles'].adultFlags);
    expect(data.rwaAdultFlags).toEqual(fixture['persist:root.rwas'].adultFlags);
    expect(data.tokens['alice@mainnet'].idle).not.toHaveProperty('manual');
    expect(s.ui.getState()).toMatchObject({
      legacyAssetsMigrated: true,
      shouldShowPromotion: true,
      promotionHidingTimestamps: { '/home': 123 },
      userId: 'stable-id',
      isAnalyticsEnabled: false
    });
    expect(s.metadata.getState().collectiblesMetadata.KT1example_0).toEqual(metadata);
    expect(s.metadata.getState().rwasMetadata.KT1example_1.name).toBe('RWA');
    expect(JSON.parse(s.records['zustand-assets'] as string).state.tokens).toEqual(data.tokens);
    expect(JSON.parse(s.records['zustand-assets'] as string).state).not.toHaveProperty('mainnetScamlist');
    const legacyBefore = Object.fromEntries(LEGACY_ASSETS_KEYS.map(key => [key, s.records[key]]));
    s.assets
      .getState()
      .putTokensAsIs([{ account: 'alice', chainId: 'mainnet', slug: 'enabled', status: 'removed', manual: false }]);
    await s.assets.persistence.flush();
    let records = s.records;
    for (let i = 0; i < 2; i++) {
      const reload = await session(records);
      await reload.migration.initialize();
      expect(reload.readFallback).not.toHaveBeenCalled();
      expect(reload.assets.getState().tokens['alice@mainnet'].enabled).toEqual({ status: 'removed', manual: false });
      expect(Object.keys(reload.assets.getState().tokens['alice@mainnet'])).toHaveLength(4);
      records = reload.records;
    }
    expect(Object.fromEntries(LEGACY_ASSETS_KEYS.map(key => [key, records[key]]))).toEqual(legacyBefore);
  }
);

it.each(LEGACY_ASSETS_KEYS)('rejects malformed present %s without fallback or writes', async key => {
  for (const invalid of [null, [], '{invalid', {}, JSON.parse('{"constructor":{}}')]) {
    const s = await session({ ...fixture, [key]: invalid });
    const before = JSON.stringify(s.records);
    await expect(s.migration.initialize()).rejects.toThrow();
    expect(s.readFallback).not.toHaveBeenCalled();
    expect(JSON.stringify(s.records)).toBe(before);
    expect(s.migration.isReady()).toBe(false);
  }
});

it.each([
  { tokens: { data: { 'bad@@key': { a: { status: 'enabled' } } } } },
  { tokens: { data: { 'a@b': { a: { status: 'missing' } } } } },
  { tokens: { data: { 'a@b': { a: { status: 'idle', manual: 0 } } } } }
])('rejects invalid asset keys/status/manual scalars', overrides => {
  expect(() =>
    parseLegacyAssetsSources({ ...fixture, 'persist:root.assets': { ...fixture['persist:root.assets'], ...overrides } })
  ).toThrow();
});

it('rejects invalid flags, timestamps, metadata and unsafe ignored graphs', () => {
  for (const [key, value] of [
    ['persist:root.collectibles', { adultFlags: { nft: { val: 'false', ts: 1 } } }],
    ['persist:root.rwas', { adultFlags: { nft: { val: false, ts: Infinity } } }],
    ['persist:root.partnersPromotion', { shouldShowPromotion: 1, promotionHidingTimestamps: {} }],
    ['persist:root.partnersPromotion', { shouldShowPromotion: false, promotionHidingTimestamps: { x: NaN } }],
    ['persist:root.collectiblesMetadata', { records: [{ ...metadata, decimals: -1 }] }],
    ['persist:root.rwasMetadata', { records: [{ ...metadata, address: 'a'.repeat(513), id: '0' }] }],
    ['persist:root.assets', { ...fixture['persist:root.assets'], ignored: JSON.parse('{"__proto__":{}}') }]
  ])
    expect(() => parseLegacyAssetsSources({ ...fixture, [key as string]: value })).toThrow();
});

it('never turns a failed browser read into fallback or a fresh installation', async () => {
  const s = await session();
  (s.storage.get as jest.Mock).mockRejectedValueOnce(new Error('read failed'));
  await expect(s.migration.initialize()).rejects.toThrow('read failed');
  expect(s.readFallback).not.toHaveBeenCalled();
  await s.migration.initialize();
  expect(s.migration.isReady()).toBe(true);
});

it.each(['zustand-assets', 'zustand-metadata', 'completion'])(
  'recovers from partial %s write failure in the same owner and after interruption',
  async failing => {
    for (const shouldReload of [false, true]) {
      const s = await session();
      let hasFailed = false;
      (s.storage.set as jest.Mock).mockImplementation(async items => {
        const isCompletion = items['zustand-ui'] && JSON.parse(items['zustand-ui']).state.legacyAssetsMigrated;
        if (!hasFailed && (failing === 'completion' ? isCompletion : failing in items)) {
          hasFailed = true;
          throw new Error('disk failure');
        }
        Object.assign(s.records, items);
      });
      await expect(s.migration.initialize()).rejects.toThrow();
      expect(s.migration.isReady()).toBe(false);
      expect(JSON.parse(s.records['zustand-ui'] as string).state.legacyAssetsMigrated).toBe(false);
      // Drain other accepted writes, as if the process stopped after partial cross-store persistence.
      await microtasks();
      const retry = shouldReload ? await session(s.records) : s;
      await retry.migration.initialize();
      expect(retry.migration.isReady()).toBe(true);
      expect(retry.assets.getState().tokens).toEqual(fixture['persist:root.assets'].tokens.data);
      for (const key of LEGACY_ASSETS_KEYS) expect(retry.records[key]).toEqual(fixture[key]);
    }
  }
);

it('rejects independent read-back mismatch and retries intact sources', async () => {
  const s = await session();
  const original = s.storage.get;
  let reads = 0;
  (s.storage.get as jest.Mock).mockImplementation(async key => {
    if (key === 'zustand-assets' && ++reads === 2) return {};
    return Object.prototype.hasOwnProperty.call(s.records, key) ? { [key]: s.records[key] } : {};
  });
  await expect(s.migration.initialize()).rejects.toThrow('read-back');
  expect(s.migration.isReady()).toBe(false);
  expect(original).toBe(s.storage.get);
  await s.migration.initialize();
  expect(s.migration.isReady()).toBe(true);
});

it('keeps destination-only keys and unrelated storage, while retained source keys win pre-completion conflicts', async () => {
  const s = await session({
    ...fixture,
    unrelated: { keep: true },
    'persist:temple-root-task11': { balances: 'keep' }
  });
  await s.assets.hydration.retry();
  s.assets.getState().putTokensAsIs([
    { account: 'alice', chainId: 'mainnet', slug: 'enabled', status: 'removed' },
    { account: 'alice', chainId: 'mainnet', slug: 'destination-only', status: 'disabled', manual: true }
  ]);
  s.metadata.getState().putRwaMetadataDirectly('only_0', { ...metadata, address: 'only' });
  await s.migration.initialize();
  expect(s.assets.getState().tokens['alice@mainnet'].enabled).toEqual({ status: 'enabled', manual: true });
  expect(s.assets.getState().tokens['alice@mainnet']['destination-only']).toEqual({ status: 'disabled', manual: true });
  expect(s.metadata.getState().rwasMetadata.only_0.address).toBe('only');
  expect(s.records.unrelated).toEqual({ keep: true });
  expect(s.records['persist:temple-root-task11']).toEqual({ balances: 'keep' });
});

it('blocks a failed nested browser or localStorage read without choosing another source, then retries repaired storage', async () => {
  const s = await session({});
  (s.storage.get as jest.Mock).mockImplementation(async key => {
    if (key === 'persist:root.assets') throw new Error('source unavailable');
    return { [key]: s.records[key] };
  });
  await expect(s.migration.initialize()).rejects.toThrow('source unavailable');
  expect(s.readFallback).not.toHaveBeenCalled();
  (s.storage.get as jest.Mock).mockImplementation(async key => ({ [key]: s.records[key] }));
  s.readFallback.mockRejectedValueOnce(new Error('localStorage unavailable'));
  await expect(s.migration.initialize()).rejects.toThrow('localStorage unavailable');
  expect(s.migration.isReady()).toBe(false);
  await s.migration.initialize();
  expect(s.migration.isReady()).toBe(true);
});

it('recovers from completion verification failure using independently persisted destinations on reload', async () => {
  const s = await session();
  let hasFailed = false;
  (s.storage.get as jest.Mock).mockImplementation(async key => {
    if (key === 'zustand-ui' && JSON.parse(s.records[key] as string).state.legacyAssetsMigrated && !hasFailed) {
      hasFailed = true;
      throw new Error('completion verification unavailable');
    }
    return { [key]: s.records[key] };
  });
  await expect(s.migration.initialize()).rejects.toThrow('completion verification unavailable');
  expect(s.migration.isReady()).toBe(false);
  const reload = await session(s.records);
  await reload.migration.initialize();
  expect(reload.migration.isReady()).toBe(true);
  expect(reload.assets.getState().tokens).toEqual(fixture['persist:root.assets'].tokens.data);
  delete reload.records['zustand-assets'];
  const incomplete = await session(reload.records);
  await expect(incomplete.migration.initialize()).rejects.toThrow('destinations missing');
});

it('uses the production slug helper for metadata arrays and preserves last-record Map semantics', () => {
  const result = parseLegacyAssetsSources({
    ...fixture,
    'persist:root.collectiblesMetadata': {
      records: [metadata, { ...metadata, name: 'Last' }, { ...metadata, id: '1e+2' }]
    }
  });
  expect(result.collectiblesMetadata.KT1example_0.name).toBe('Last');
  expect(result.collectiblesMetadata.KT1example_100.id).toBe('1e+2');
  expect(() =>
    parseLegacyAssetsSources({
      ...fixture,
      'persist:root.rwasMetadata': { records: [{ ...metadata, id: 'not-a-number' }] }
    })
  ).toThrow();
});
