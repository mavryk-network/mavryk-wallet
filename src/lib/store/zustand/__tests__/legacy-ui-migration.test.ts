import { ANALYTICS_USER_ID_STORAGE_KEY } from 'lib/constants';

import { awaitStoresHydrated } from '../await-stores-hydrated';
import { createLegacyUIMigration } from '../legacy-ui-migration';
import { LEGACY_UI_ROOT_KEY } from '../legacy-ui-source';
import { createMetadataStore } from '../metadata.store';
import fixture from '../test-support/fixtures/legacy-ui-root.json';
import { deferred, memoryStorage } from '../test-support/helpers';
import { createUIStore } from '../ui.store';

const ID = ANALYTICS_USER_ID_STORAGE_KEY;
const serialized = () =>
  JSON.stringify(Object.fromEntries(Object.entries(fixture).map(([key, value]) => [key, JSON.stringify(value)])));
function session(records: Record<string, unknown> = {}, fallback: string | null = null) {
  const memory = memoryStorage(records);
  const ui = createUIStore(memory.storage);
  const metadata = createMetadataStore(memory.storage);
  const readFallback = jest.fn(async () => fallback);
  const generateId = jest.fn(() => 'fresh-id');
  const migration = createLegacyUIMigration({ ui, metadata, storage: memory.storage, readFallback, generateId });
  return { ...memory, ui, metadata, migration, readFallback, generateId };
}

// Constructed, sanitized fixtures based on inspected production reducers/storage config; not captured from a user profile.
describe('legacy UI migration', () => {
  it.each([fixture, JSON.stringify(fixture), serialized()])(
    'migrates browser object/string roots with durable ID precedence',
    async root => {
      const s = session({ [LEGACY_UI_ROOT_KEY]: root, [ID]: 'durable-id' }, '{invalid fallback');
      await s.migration.initialize();
      expect(s.ui.getState()).toMatchObject({
        userId: 'durable-id',
        isAnalyticsEnabled: false,
        balanceMode: 'gas',
        isOnRampPossibility: true,
        abTestGroupName: 'A',
        lastSeenPromotionName: 'sanitized-promotion',
        shouldShowNewsletterModal: false,
        isNewsEnabled: false,
        legacyMigrated: true
      });
      expect(s.metadata.getState().tokensMetadata).toMatchObject(fixture.tokensMetadata.metadataRecord);
      expect(Object.keys(s.metadata.getState().tokensMetadata).length).toBeGreaterThan(1);
      expect(s.readFallback).not.toHaveBeenCalled();
      expect(s.generateId).not.toHaveBeenCalled();
      expect(s.records[LEGACY_UI_ROOT_KEY]).toEqual(root);
      expect(s.records[ID]).toBe('durable-id');
      expect(s.migration.isReady()).toBe(true);
    }
  );

  it('uses serialized localStorage only after a successful missing browser read', async () => {
    const s = session({}, serialized());
    await s.migration.initialize();
    expect(s.readFallback).toHaveBeenCalledTimes(1);
    expect(s.ui.getState().userId).toBe(fixture.settings.userId);
    expect(s.records[ID]).toBe(fixture.settings.userId);
  });

  it('fresh install generates only after successful reads; subsequent startup is a durable no-op', async () => {
    const s = session();
    await s.migration.initialize();
    expect(s.generateId).toHaveBeenCalledTimes(1);
    expect(s.ui.getState()).toMatchObject({ userId: 'fresh-id', isAnalyticsEnabled: false });
    const reloaded = session(s.records);
    await reloaded.migration.initialize();
    expect(reloaded.storage.set).not.toHaveBeenCalled();
    expect(reloaded.readFallback).not.toHaveBeenCalled();
    expect(reloaded.generateId).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    1,
    'null',
    '[]',
    '{invalid',
    { settings: [] },
    { settings: { balanceMode: 'invalid' } },
    { abTesting: { groupName: 'invalid' } },
    { settings: { isAnalyticsEnabled: 'true' } },
    { newsletter: { shouldShowNewsletterModal: 1 } },
    { tokensMetadata: { metadataRecord: [] } },
    { tokensMetadata: { metadataRecord: { slug: { decimals: Infinity } } } },
    JSON.parse('{"settings":{"__proto__":{"polluted":true}}}'),
    { settings: '{"constructor":{}}' },
    { ignored: '{"nested":{"prototype":{}}}' }
  ])('fails closed before all writes on malformed/unsafe source %#', async root => {
    const s = session({ [LEGACY_UI_ROOT_KEY]: root });
    await expect(s.migration.initialize()).rejects.toBeDefined();
    expect(s.storage.set).not.toHaveBeenCalled();
    expect(s.generateId).not.toHaveBeenCalled();
    expect(s.ui.getState().userId).toBeNull();
    expect(s.migration.isReady()).toBe(false);
    expect(s.readFallback).not.toHaveBeenCalled();
  });

  it.each(['', 123, 'bad id', 'x'.repeat(257)])('does not replace invalid durable identities %#', async id => {
    const s = session({ [ID]: id, [LEGACY_UI_ROOT_KEY]: fixture });
    await expect(s.migration.initialize()).rejects.toBeDefined();
    expect(s.storage.set).not.toHaveBeenCalled();
  });

  it('awaits real asynchronous hydration and shares concurrent initialization', async () => {
    const read = deferred<Record<string, unknown>>();
    const s = session({ [LEGACY_UI_ROOT_KEY]: fixture });
    (s.storage.get as jest.Mock).mockImplementationOnce(() => read.promise);
    const first = s.migration.initialize();
    expect(s.migration.initialize()).toBe(first);
    expect(s.storage.set).not.toHaveBeenCalled();
    read.resolve({});
    await first;
    expect(s.migration.isReady()).toBe(true);
  });

  it.each(['zustand-ui', 'zustand-metadata', LEGACY_UI_ROOT_KEY, ID])(
    'retries rejected reads at %s without generating identity',
    async key => {
      const s = session({ [LEGACY_UI_ROOT_KEY]: fixture });
      const get = s.storage.get;
      let shouldFail = true;
      (s.storage.get as jest.Mock).mockImplementation(async requested => {
        if (requested === key && shouldFail) throw new Error('read failed');
        return Object.prototype.hasOwnProperty.call(s.records, requested) ? { [requested]: s.records[requested] } : {};
      });
      await expect(s.migration.initialize()).rejects.toBeDefined();
      expect(s.storage.set).not.toHaveBeenCalled();
      expect(s.generateId).not.toHaveBeenCalled();
      shouldFail = false;
      await s.migration.initialize();
      expect(s.migration.isReady()).toBe(true);
      expect(get).toBe(s.storage.get);
    }
  );

  it('fallback read failure is not a fresh install and is retryable', async () => {
    const s = session();
    s.readFallback.mockRejectedValueOnce(new Error('unavailable'));
    await expect(s.migration.initialize()).rejects.toThrow('unavailable');
    expect(s.generateId).not.toHaveBeenCalled();
    expect(s.storage.set).not.toHaveBeenCalled();
    await s.migration.initialize();
  });

  it.each(['zustand-ui', 'zustand-metadata', ID, 'completion'])(
    'recovers durable partial writes/reload after %s failure',
    async key => {
      const s = session({ [LEGACY_UI_ROOT_KEY]: fixture });
      let shouldFail = true;
      (s.storage.set as jest.Mock).mockImplementation(async items => {
        const [name, value] = Object.entries(items)[0];
        const isCompletion = name === 'zustand-ui' && JSON.parse(value as string).state.legacyMigrated;
        if (shouldFail && (key === 'completion' ? isCompletion : name === key)) throw new Error('write failed');
        Object.assign(s.records, items);
      });
      await expect(s.migration.initialize()).rejects.toThrow();
      expect(s.migration.isReady()).toBe(false);
      expect(JSON.parse(String(s.records['zustand-ui'] ?? '{"state":{}}')).state.legacyMigrated).not.toBe(true);
      // Simulate interruption: a new owner hydrates only the durable subset, then replays the intact source.
      const reloaded = session(s.records);
      await reloaded.migration.initialize();
      expect(reloaded.ui.getState()).toMatchObject({ userId: fixture.settings.userId, legacyMigrated: true });
      expect(reloaded.metadata.getState().tokensMetadata).toMatchObject(fixture.tokensMetadata.metadataRecord);
      shouldFail = false;
      await s.migration.initialize();
      expect(s.migration.isReady()).toBe(true);
    }
  );

  it('does not mistake resolved writes, key existence or RAM for durable destination/completion verification', async () => {
    const s = session({ [LEGACY_UI_ROOT_KEY]: fixture });
    (s.storage.set as jest.Mock).mockResolvedValue(undefined);
    await expect(s.migration.initialize()).rejects.toThrow('read-back');
    expect(s.migration.isReady()).toBe(false);
    expect(s.records[ID]).toBeUndefined();
  });

  it('preserves post-migration preference/metadata changes across reload instead of replaying legacy', async () => {
    const s = session({ [LEGACY_UI_ROOT_KEY]: fixture });
    await s.migration.initialize();
    s.ui.getState().setIsNewsEnabled(true);
    s.ui.getState().setAnalyticsEnabled(true);
    s.metadata.getState().putTokenMetadataDirectly('KT1sanitized_0', {
      ...fixture.tokensMetadata.metadataRecord.KT1sanitized_0,
      name: 'Changed'
    });
    await Promise.all([s.ui.persistence.flush(), s.metadata.persistence.flush()]);
    const reloaded = session(s.records);
    await reloaded.migration.initialize();
    expect(reloaded.ui.getState()).toMatchObject({ isNewsEnabled: true, isAnalyticsEnabled: true });
    expect(reloaded.metadata.getState().tokensMetadata.KT1sanitized_0.name).toBe('Changed');
    expect(reloaded.storage.set).not.toHaveBeenCalled();
  });

  it('accepts already persisted Task 10 version-1 UI envelopes without a completion field', async () => {
    const s = session();
    await awaitStoresHydrated(s.ui, s.metadata);
    s.ui.getState().setUserId('task10-id');
    await s.ui.persistence.flush();
    const envelope = JSON.parse(s.records['zustand-ui'] as string);
    delete envelope.state.legacyMigrated;
    const reloaded = session({ 'zustand-ui': envelope });
    await reloaded.migration.initialize();
    expect(reloaded.ui.getState().userId).toBe('task10-id');
    expect(reloaded.generateId).not.toHaveBeenCalled();
  });
});

it('does not publish completion while destination writes are in flight', async () => {
  const s = session({ [LEGACY_UI_ROOT_KEY]: fixture });
  const write = deferred<void>();
  (s.storage.set as jest.Mock).mockImplementation(async items => {
    if (items['zustand-metadata']) await write.promise;
    Object.assign(s.records, items);
  });
  const attempt = s.migration.initialize();
  for (let i = 0; i < 60; i++) await Promise.resolve();
  expect(s.migration.isReady()).toBe(false);
  expect(s.ui.getState().legacyMigrated).toBe(false);
  expect(s.records[ID]).toBeUndefined();
  write.resolve();
  await attempt;
  expect(s.migration.isReady()).toBe(true);
});

it('independently verifies completion and can recover a failed completion read on retry', async () => {
  const s = session({ [LEGACY_UI_ROOT_KEY]: fixture });
  let shouldFail = true;
  (s.storage.get as jest.Mock).mockImplementation(async key => {
    const raw = s.records[key];
    if (shouldFail && key === 'zustand-ui' && typeof raw === 'string' && JSON.parse(raw).state.legacyMigrated) {
      throw new Error('completion read failed');
    }
    return raw === undefined ? {} : { [key]: raw };
  });
  await expect(s.migration.initialize()).rejects.toThrow('completion read failed');
  expect(s.migration.isReady()).toBe(false);
  shouldFail = false;
  await s.migration.initialize();
  expect(s.migration.isReady()).toBe(true);
});

it('validates all metadata before staging any preference changes and retains predefined overrides', async () => {
  const invalid = JSON.parse(JSON.stringify(fixture));
  invalid.tokensMetadata.metadataRecord.KT1sanitized_0.name = 'x'.repeat(8193);
  const s = session({ [LEGACY_UI_ROOT_KEY]: invalid });
  await expect(s.migration.initialize()).rejects.toThrow();
  expect(s.ui.getState().shouldShowNewsletterModal).toBe(true);
  expect(s.storage.set).not.toHaveBeenCalled();
  const slug = Object.keys(s.metadata.getState().tokensMetadata)[0];
  const source = JSON.parse(JSON.stringify(fixture));
  source.tokensMetadata.metadataRecord[slug] = {
    ...s.metadata.getState().tokensMetadata[slug],
    name: 'Legacy override'
  };
  s.records[LEGACY_UI_ROOT_KEY] = source;
  await s.migration.initialize();
  expect(s.metadata.getState().tokensMetadata[slug].name).toBe('Legacy override');
});
