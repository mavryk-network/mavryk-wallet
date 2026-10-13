import type { Runtime } from 'webextension-polyfill';

import { OWNER_FALLBACK_KEYS } from '../owner-fallback';
import fixture from '../test-support/fixtures/legacy-ui-root.json';
import { deferred, memoryStorage } from '../test-support/helpers';
import { UI_OWNER_CHANNEL } from '../ui-owner.contract';

function setup(initial: Record<string, unknown> = { 'persist:temple-root': fixture, analytics_user_id: 'durable-id' }) {
  const memory = memoryStorage(initial);
  const storageListeners: Array<(changes: Record<string, unknown>, area: string) => void> = [];
  let listener!: (
    message: unknown,
    sender: Runtime.MessageSender
  ) => Promise<{ error?: string; snapshot?: { ui: { userId: string; isNewsEnabled: boolean } } }>;
  jest.doMock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
      storage: {
        local: memory.storage,
        onChanged: {
          addListener: (listener: (changes: Record<string, unknown>, area: string) => void) =>
            storageListeners.push(listener)
        }
      },
      runtime: {
        id: 'test-extension',
        getURL: (path: string) => `moz-extension://test/${path}`,
        onMessage: {
          addListener: (callback: typeof listener) => {
            listener = callback;
          }
        }
      }
    }
  }));
  let owner!: typeof import('../ui-owner');
  jest.isolateModules(() => {
    owner = require('../ui-owner');
  });
  owner.startUIOwner();
  const request = (
    values: object = {},
    sender: Runtime.MessageSender = {
      id: 'test-extension',
      url: 'moz-extension://test/fullpage.html'
    }
  ) =>
    listener(
      {
        channel: UI_OWNER_CHANNEL,
        assetsFallback: Object.fromEntries(OWNER_FALLBACK_KEYS.map(key => [key, null])),
        ...values
      },
      sender
    );
  return {
    ...memory,
    owner,
    request,
    changeSelection: () => storageListeners.forEach(listener => listener({ network_id: {} }, 'local'))
  };
}

afterEach(() => {
  jest.dontMock('webextension-polyfill');
});

it('serializes concurrent contexts, adopts identity once, and never enables opted-out analytics', async () => {
  const s = setup();
  expect(s.owner.getReadyAnalyticsIdentity()).toBeNull();
  const [first, second] = await Promise.all([s.request(), s.request()]);
  expect(first.snapshot?.ui.userId).toBe('durable-id');
  expect(second.snapshot?.ui.userId).toBe('durable-id');
  expect(s.owner.getReadyAnalyticsIdentity()).toBeNull();
  expect(s.records.analytics_user_id).toBe('durable-id');
  const [a, b] = await Promise.all([
    s.request({ command: { kind: 'preferences', values: { isNewsEnabled: true } } }),
    s.request({ command: { kind: 'preferences', values: { isNewsEnabled: false } } })
  ]);
  expect(a.snapshot?.ui.isNewsEnabled).toBe(true);
  expect(b.snapshot?.ui.isNewsEnabled).toBe(false);
  const reload = setup(s.records);
  expect((await reload.request()).snapshot?.ui.isNewsEnabled).toBe(false);
});

it('requests foreground fallback only for missing browser source and does not generate a temporary ID', async () => {
  const s = setup({});
  expect(await s.request()).toEqual({ error: 'fallback-required' });
  expect(s.storage.set).not.toHaveBeenCalled();
  expect(s.owner.getReadyAnalyticsIdentity()).toBeNull();
  const result = await s.request({ fallback: JSON.stringify(fixture) });
  expect(result.snapshot?.ui.userId).toBe(fixture.settings.userId);
});

it('keeps analytics blocked until opt-in is durably written/read back; suppresses during write failure and retry', async () => {
  const s = setup();
  await s.request();
  const write = deferred<void>();
  (s.storage.set as jest.Mock).mockImplementationOnce(async items => {
    await write.promise;
    Object.assign(s.records, items);
  });
  const update = s.request({ command: { kind: 'preferences', values: { isAnalyticsEnabled: true } } });
  expect(s.owner.getReadyAnalyticsIdentity()).toBeNull();
  write.resolve();
  expect((await update).error).toBeUndefined();
  expect(s.owner.getReadyAnalyticsIdentity()).toBe('durable-id');
  (s.storage.set as jest.Mock).mockRejectedValueOnce(new Error('write failure'));
  expect(
    (await s.request({ command: { kind: 'preferences', values: { isAnalyticsEnabled: false } } })).error
  ).toBeDefined();
  expect(s.owner.getReadyAnalyticsIdentity()).toBeNull();
  expect((await s.request()).error).toBeUndefined();
  expect(s.owner.getReadyAnalyticsIdentity()).toBeNull();
});

it('rejects content-script senders and malformed commands before writes', async () => {
  const s = setup();
  expect((await s.request({}, { id: 'test-extension', url: 'https://example.com' })).error).toBeDefined();
  expect(s.storage.set).not.toHaveBeenCalled();
  expect((await s.request({ command: { kind: 'preferences', values: { userId: 'clobber' } } })).error).toBeDefined();
  expect(s.storage.set).not.toHaveBeenCalled();
});

it('keeps metadata puts, whitelist non-overwrite and refresh-only media fields durable across owner reload', async () => {
  const s = setup();
  await s.request();
  const record = fixture.tokensMetadata.metadataRecord.KT1sanitized_0;
  for (const [mode, name] of [
    ['put', 'New'],
    ['whitelist', 'Ignored'],
    ['refresh', 'Ignored']
  ]) {
    expect(
      (
        await s.request({
          command: {
            kind: 'metadata',
            mode,
            records: {
              KT1sanitized_0: { ...record, name, displayUri: 'ipfs://updated' }
            }
          }
        })
      ).error
    ).toBeUndefined();
  }
  const reload = setup(s.records);
  await reload.request();
  const metadata = JSON.parse(reload.records['zustand-metadata'] as string).state.tokensMetadata.KT1sanitized_0;
  expect(metadata.name).toBe('New');
  expect(metadata.displayUri).toBe('ipfs://updated');
});

it('rereads a repaired fallback on retry and generates only one identity for concurrent fresh contexts', async () => {
  const s = setup({});
  expect((await s.request({ fallback: '{invalid' })).error).toBeDefined();
  expect(await s.request()).toEqual({ error: 'fallback-required' });
  const [a, b] = await Promise.all([s.request({ fallback: null }), s.request({ fallback: null })]);
  expect(a.snapshot?.ui.userId).toBeTruthy();
  expect(b.snapshot?.ui.userId).toBe(a.snapshot?.ui.userId);
  expect((s.storage.set as jest.Mock).mock.calls.filter(([items]) => 'analytics_user_id' in items)).toHaveLength(1);
});

it('preserves explicit promotion clearing through JSON messages and durable reload', async () => {
  const s = setup();
  await s.request();
  await s.request(
    JSON.parse(JSON.stringify({ command: { kind: 'preferences', values: { lastSeenPromotionName: null } } }))
  );
  expect(JSON.parse(s.records['zustand-ui'] as string).state.lastSeenPromotionName).toBeUndefined();
  const reload = setup(s.records);
  expect((await reload.request()).error).toBeUndefined();
  expect(JSON.parse(reload.records['zustand-ui'] as string).state.lastSeenPromotionName).toBeUndefined();
});

it('serializes asset/status producers across contexts and preserves nested metadata, flags and promotion on reload', async () => {
  const s = setup();
  const value = { account: 'alice', chainId: 'mainnet', slug: 'asset', status: 'idle', manual: false };
  const [put, status] = await Promise.all([
    s.request({ command: { kind: 'assets-put', category: 'collectibles', records: [value] } }),
    s.request({
      command: {
        kind: 'assets-status',
        category: 'collectibles',
        value: { account: 'alice', chainId: 'mainnet', slug: 'asset', status: 'disabled' }
      }
    })
  ]);
  expect(put.error).toBeUndefined();
  expect(status.error).toBeUndefined();
  for (const command of [
    {
      kind: 'assets-loaded',
      category: 'collectibles',
      value: { account: 'alice', chainId: 'mainnet', slugs: ['new'] }
    },
    { kind: 'adult-flags', category: 'collectibles', flags: { asset: { val: true, ts: 100 } }, timestamp: 100 },
    { kind: 'adult-flags', category: 'rwas', flags: { rwa: { val: false, ts: 100 } }, timestamp: 100 },
    { kind: 'nested-metadata', category: 'rwasMetadata', records: fixture.tokensMetadata.metadataRecord },
    { kind: 'promotion-toggle', value: true },
    { kind: 'promotion-hide', id: '/home', timestamp: 123 }
  ])
    expect((await s.request({ command })).error).toBeUndefined();
  for (let i = 0; i < 2; i++) {
    const reload = setup(s.records);
    expect((await reload.request()).error).toBeUndefined();
    const assets = JSON.parse(reload.records['zustand-assets'] as string).state;
    expect(assets.collectibles['alice@mainnet']).toEqual({
      asset: { status: 'disabled', manual: false },
      new: { status: 'idle' }
    });
    expect(assets.collectibleAdultFlags.asset.val).toBe(true);
    expect(assets.rwaAdultFlags.rwa.val).toBe(false);
    const ui = JSON.parse(reload.records['zustand-ui'] as string).state;
    expect(ui.promotionHidingTimestamps).toEqual({ '/home': 123 });
    expect(ui.shouldShowPromotion).toBe(true);
    expect(JSON.parse(reload.records['zustand-metadata'] as string).state.rwasMetadata).toEqual(
      fixture.tokensMetadata.metadataRecord
    );
  }
});

it('does not acknowledge asset writes until durable and suppresses analytics on failure until retry', async () => {
  const s = setup();
  await s.request();
  await s.request({ command: { kind: 'preferences', values: { isAnalyticsEnabled: true } } });
  expect(s.owner.getReadyAnalyticsIdentity()).toBe('durable-id');
  (s.storage.set as jest.Mock).mockRejectedValueOnce(new Error('asset write failed'));
  const result = await s.request({
    command: {
      kind: 'assets-put',
      category: 'tokens',
      records: [{ account: 'a', chainId: 'b', slug: 'custom', status: 'enabled', manual: true }]
    }
  });
  expect(result.error).toBeDefined();
  expect(result.snapshot).toBeUndefined();
  expect(s.owner.getReadyAnalyticsIdentity()).toBeNull();
  expect((await s.request()).error).toBeUndefined();
  expect(JSON.parse(s.records['zustand-assets'] as string).state.tokens['a@b'].custom.manual).toBe(true);
  expect(s.owner.getReadyAnalyticsIdentity()).toBe('durable-id');
});

it('expires adult flags and removes only no-longer-owned automatic idle assets', async () => {
  const s = setup();
  await s.request({
    command: {
      kind: 'assets-put',
      category: 'rwas',
      records: [
        { account: 'a', chainId: 'b', slug: 'automatic', status: 'idle', manual: false },
        { account: 'a', chainId: 'b', slug: 'manual', status: 'idle', manual: true },
        { account: 'a', chainId: 'b', slug: 'removed', status: 'removed' }
      ]
    }
  });
  await s.request({
    command: { kind: 'assets-loaded', category: 'rwas', value: { account: 'a', chainId: 'b', slugs: [] } }
  });
  expect(JSON.parse(s.records['zustand-assets'] as string).state.rwas['a@b']).toEqual({
    manual: { status: 'idle', manual: true },
    removed: { status: 'removed' }
  });
  await s.request({
    command: { kind: 'adult-flags', category: 'rwas', flags: { old: { val: true, ts: 0 } }, timestamp: 0 }
  });
  await s.request({
    command: { kind: 'adult-flags', category: 'rwas', flags: { current: { val: false, ts: 20000 } }, timestamp: 20000 }
  });
  expect(JSON.parse(s.records['zustand-assets'] as string).state.rwaAdultFlags).toEqual({
    current: { val: false, ts: 20000 }
  });
});

it('serializes Task 14 after legacy readiness, blocks analytics and waits before later user commands', async () => {
  const entered = deferred<void>();
  const finish = deferred<void>();
  const run = jest.fn(
    async (stores: { ui: { getState: () => { legacyMigrated: boolean; legacyAssetsMigrated: boolean } } }) => {
      expect(stores.ui.getState().legacyMigrated).toBe(true);
      expect(stores.ui.getState().legacyAssetsMigrated).toBe(true);
      entered.resolve();
      await finish.promise;
    }
  );
  jest.doMock('lib/assets/indexeddb-migration-owner', () => ({ runIndexedDBAssetsMigration: run }));
  try {
    const s = setup();
    const first = s.request({ command: { kind: 'indexeddb-assets-migration' } });
    await entered.promise;
    const second = s.request({ command: { kind: 'preferences', values: { isNewsEnabled: false } } });
    expect(s.owner.getReadyAnalyticsIdentity()).toBeNull();
    finish.resolve();
    expect((await first).error).toBeUndefined();
    expect((await second).snapshot?.ui.isNewsEnabled).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    run.mockRejectedValueOnce(new Error('IndexedDB unavailable'));
    expect((await s.request({ command: { kind: 'indexeddb-assets-migration' } })).error).toBeDefined();
    expect(s.owner.getReadyAnalyticsIdentity()).toBeNull();
    expect((await s.request({ command: { kind: 'indexeddb-assets-migration' } })).error).toBeUndefined();
  } finally {
    jest.dontMock('lib/assets/indexeddb-migration-owner');
  }
});

it('orders security refreshes across contexts, persists successful empty responses and retains labels after failure/restart', async () => {
  const s = setup();
  await s.request();
  const send = (command: object) => s.request({ command });
  const read = () => JSON.parse(s.records['zustand-assets'] as string).state;
  await send({ kind: 'assets-sync-start', requestKey: 'scamlist', requestId: 'old' });
  await send({ kind: 'assets-sync-start', requestKey: 'scamlist', requestId: 'new' });
  await send({ kind: 'scamlist-sync', requestKey: 'scamlist', requestId: 'new', data: { scam: true } });
  await send({ kind: 'scamlist-sync', requestKey: 'scamlist', requestId: 'old', data: {} });
  expect(read().mainnetScamlist).toEqual({ scam: true });
  expect(
    (await send({ kind: 'scamlist-sync', requestKey: 'scamlist', requestId: 'new', data: null })).error
  ).toBeDefined();
  expect(read().mainnetScamlist).toEqual({ scam: true });
  const restart = setup(s.records);
  expect((await restart.request()).error).toBeUndefined();
  expect(JSON.parse(restart.records['zustand-assets'] as string).state.mainnetScamlist).toEqual({ scam: true });
  await send({ kind: 'scamlist-sync', requestKey: 'scamlist', requestId: 'new', data: {} });
  expect(read().mainnetScamlist).toEqual({});
});

it('reconciles fetched lists with durable choices, rejects superseded/user-edited requests and preserves metadata on late scopes', async () => {
  const s = setup();
  await s.request();
  const send = (command: object) => s.request({ command });
  const read = () => JSON.parse(s.records['zustand-assets'] as string).state;
  const requestKey = 'collectibles:alice@chain';
  const start = (requestId: string) => send({ kind: 'assets-sync-start', requestKey, requestId });
  const publish = (requestId: string, slugs: string[]) =>
    send({
      kind: 'assets-sync',
      requestKey,
      requestId,
      category: 'collectibles',
      value: { account: 'alice', chainId: 'chain', slugs },
      metadata: {}
    });
  const records = [
    { slug: 'manual', status: 'idle', manual: true },
    { slug: 'disabled', status: 'disabled' },
    { slug: 'removed', status: 'removed' },
    { slug: 'automatic', status: 'idle' }
  ].map(value => ({ ...value, account: 'alice', chainId: 'chain' }));
  await send({ kind: 'assets-put', category: 'collectibles', records });
  await start('one');
  await publish('one', ['fetched']);
  expect(read().collectibles['alice@chain']).toEqual({
    manual: { status: 'idle', manual: true },
    disabled: { status: 'disabled' },
    removed: { status: 'removed' },
    fetched: { status: 'idle' }
  });
  await start('two');
  await send({
    kind: 'assets-status',
    category: 'collectibles',
    value: { account: 'alice', chainId: 'chain', slug: 'disabled', status: 'idle' }
  });
  await publish('two', []);
  expect(read().collectibles['alice@chain'].disabled.status).toBe('idle');
  expect(read().collectibles['alice@chain'].fetched).toBeDefined();
  await start('old');
  await start('new');
  await publish('new', ['latest']);
  await publish('old', ['obsolete']);
  expect(read().collectibles['alice@chain'].latest).toBeDefined();
  expect(read().collectibles['alice@chain'].obsolete).toBeUndefined();
  await start('changed');
  s.changeSelection();
  s.changeSelection();
  await publish('changed', ['wrong-network']);
  expect(read().collectibles['alice@chain']['wrong-network']).toBeUndefined();
  await start('empty');
  await publish('empty', []);
  expect(read().collectibles['alice@chain']).toEqual({
    manual: { status: 'idle', manual: true },
    removed: { status: 'removed' }
  });
  await start('restart');
  const restart = setup(s.records);
  await restart.request({
    command: {
      kind: 'assets-sync',
      requestKey,
      requestId: 'restart',
      category: 'collectibles',
      value: { account: 'alice', chainId: 'chain', slugs: ['obsolete'] },
      metadata: {}
    }
  });
  expect(
    JSON.parse(restart.records['zustand-assets'] as string).state.collectibles['alice@chain'].obsolete
  ).toBeUndefined();
});

it('orders metadata across foregrounds, protects explicit saves and rejects selection/restart-late responses', async () => {
  const s = setup();
  await s.request();
  const scopeKey = JSON.stringify(['alice', 'chain', 'network', 'rpc']);
  const records = { KT1test_0: { address: 'KT1test', id: '0', name: 'Fetched', symbol: 'F', decimals: 0 } };
  const start = (requestId: string) => s.request({ command: { kind: 'metadata-sync-start', scopeKey, requestId } });
  const publish = (requestId: string) =>
    s.request({ command: { kind: 'metadata-sync', scopeKey, requestId, category: 'tokens', mode: 'put', records } });
  await start('old');
  await s.request({
    command: {
      kind: 'metadata-save',
      scopeKey,
      category: 'tokens',
      records: { KT1test_0: { ...records.KT1test_0, name: 'User' } }
    }
  });
  expect((await publish('old')).snapshot).toMatchObject({
    metadata: { scoped: { [scopeKey]: { tokensMetadata: { KT1test_0: { name: 'User' } } } } }
  });
  await start('late');
  s.changeSelection();
  const late = await publish('late');
  expect(late.snapshot).not.toMatchObject({ metadata: { lastReceipt: 'late' } });
  await start('restart');
  const restarted = setup(s.records);
  const afterRestart = await restarted.request({
    command: { kind: 'metadata-sync', scopeKey, requestId: 'restart', category: 'tokens', mode: 'put', records }
  });
  expect(afterRestart.snapshot).not.toMatchObject({ metadata: { lastReceipt: 'restart' } });
  expect(afterRestart.snapshot).toMatchObject({
    metadata: { scoped: { [scopeKey]: { tokensMetadata: { KT1test_0: { name: 'User' } } } } }
  });
});

it('acknowledges metadata only after actual storage succeeds, and preserves it after recovery', async () => {
  const s = setup();
  await s.request();
  await s.request({ command: { kind: 'metadata-sync-start', scopeKey: 'scope', requestId: 'request' } });
  const records = { KT1test_0: { address: 'KT1test', id: '0', name: 'Fetched', symbol: 'F', decimals: 0 } };
  (s.storage.set as jest.Mock).mockRejectedValueOnce(new Error('write failed'));
  expect(
    await s.request({
      command: {
        kind: 'metadata-sync',
        scopeKey: 'scope',
        requestId: 'request',
        category: 'tokens',
        mode: 'put',
        records
      }
    })
  ).toHaveProperty('error');
  const recovered = await s.request();
  expect(recovered.snapshot).toMatchObject({ metadata: { scoped: { scope: { tokensMetadata: records } } } });
  expect((await setup(s.records).request()).snapshot).toMatchObject({
    metadata: { scoped: { scope: { tokensMetadata: records } } }
  });
});

it('reuses scoped coupled asset metadata policy without letting older asset responses overwrite user saves', async () => {
  const s = setup();
  await s.request();
  const records = { KT1test_0: { address: 'KT1test', id: '0', name: 'Fetched', symbol: 'F', decimals: 0 } };
  await s.request({ command: { kind: 'assets-sync-start', requestKey: 'assets', requestId: 'old' } });
  await s.request({
    command: {
      kind: 'metadata-save',
      scopeKey: 'scope',
      category: 'tokens',
      records: { KT1test_0: { ...records.KT1test_0, name: 'User' } }
    }
  });
  const result = await s.request({
    command: {
      kind: 'assets-sync',
      requestKey: 'assets',
      requestId: 'old',
      scopeKey: 'scope',
      category: 'tokens',
      value: { account: 'alice', chainId: 'chain', slugs: ['KT1test_0'] },
      metadata: records
    }
  });
  expect(result.snapshot).toMatchObject({
    metadata: { scoped: { scope: { tokensMetadata: { KT1test_0: { name: 'User' } } } } },
    assets: { tokens: { 'alice@chain': { KT1test_0: { status: 'idle' } } } }
  });
});
