import type { Runtime } from 'webextension-polyfill';

import fixture from '../test-support/fixtures/legacy-ui-root.json';
import { deferred, memoryStorage } from '../test-support/helpers';
import { UI_OWNER_CHANNEL } from '../ui-owner.contract';

function setup(initial: Record<string, unknown> = { 'persist:temple-root': fixture, analytics_user_id: 'durable-id' }) {
  const memory = memoryStorage(initial);
  let listener!: (
    message: unknown,
    sender: Runtime.MessageSender
  ) => Promise<{ error?: string; snapshot?: { ui: { userId: string; isNewsEnabled: boolean } } }>;
  jest.doMock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
      storage: { local: memory.storage, onChanged: { addListener: jest.fn() } },
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
  ) => listener({ channel: UI_OWNER_CHANNEL, ...values }, sender);
  return { ...memory, owner, request };
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
