import type { Runtime } from 'webextension-polyfill';

import { TempleChainId } from 'lib/temple/types';

import { OWNER_FALLBACK_KEYS } from '../owner-fallback';
import profile from '../test-support/fixtures/profile-2.0.9.json';
import { memoryStorage } from '../test-support/helpers';
import { UI_OWNER_CHANNEL } from '../ui-owner.contract';

// Storage of a real 2.0.9 Basenet profile (addresses/ids anonymized) captured right before the 3.0.0 update:
// 11 tokens (two hidden and one removed older RWAs), 10 `/assets` RWAs, 104 token metadata records.
const LEGACY = profile.local;
const LEGACY_KEYS = Object.keys(LEGACY) as (keyof typeof LEGACY)[];
const ACCOUNT = 'mv1Fixture1xxxxxxxxxxxxxxxxxxxxxxxxx';
const KEY = `${ACCOUNT}@${TempleChainId.Basenet}`;
const HIDDEN = ['KT18jYZuGDajywWdCniEkfxdPeRWZFyrEuUg_0', 'KT1DoCAu9Hyx2gy8BFV6HUvMNSiqPJiNPLAY_0'];
const REMOVED = 'KT1NkKkvSFYMYfaTxAFkMAKiDqZEt53UoV4a_0';
const legacyAssets = LEGACY['persist:root.assets'] as unknown as Record<
  'tokens' | 'collectibles' | 'rwas',
  { data: Record<string, Record<string, { status: string }>> }
>;

type Snapshot = {
  ui: Record<string, unknown>;
  metadata: Record<'tokensMetadata' | 'collectiblesMetadata' | 'rwasMetadata', Record<string, Record<string, unknown>>>;
  assets: Record<string, Record<string, Record<string, { status: string }>>>;
  balances: { isBalancesAdopted: boolean; legacy: Record<string, Record<string, string>> };
};

/** Boot a fresh 3.0.0 background owner on the given browser.storage.local records. */
function boot(initial: Record<string, unknown>) {
  const memory = memoryStorage(initial);
  let listener!: (message: unknown, sender: Runtime.MessageSender) => Promise<{ error?: string; snapshot?: Snapshot }>;
  jest.doMock('webextension-polyfill', () => ({
    __esModule: true,
    default: {
      storage: { local: memory.storage, onChanged: { addListener: () => undefined } },
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
  jest.isolateModules(() => {
    require('../ui-owner').startUIOwner();
  });
  const request = async (values: object = {}) => {
    const response = await listener(
      {
        channel: UI_OWNER_CHANNEL,
        assetsFallback: Object.fromEntries(OWNER_FALLBACK_KEYS.map(key => [key, null])),
        ...values
      },
      { id: 'test-extension', url: 'moz-extension://test/fullpage.html' }
    );
    expect(response.error).toBeUndefined();
    if (!response.snapshot) throw new Error('Owner returned no snapshot');
    return response.snapshot;
  };
  return { ...memory, request };
}

afterEach(() => {
  jest.dontMock('webextension-polyfill');
});

it('migrates a real 2.0.9 profile without losing records or touching rollback sources', async () => {
  const s = boot(JSON.parse(JSON.stringify(LEGACY)));
  const snapshot = await s.request();

  expect(snapshot.ui).toMatchObject({
    legacyMigrated: true,
    legacyAssetsMigrated: true,
    balanceMode: 'fiat',
    isAnalyticsEnabled: false,
    userId: 'fixture-analytics-id'
  });

  // Every asset record and status carries over per category, account and chain.
  for (const category of ['tokens', 'collectibles', 'rwas'] as const) {
    for (const [key, records] of Object.entries(legacyAssets[category].data)) {
      for (const [slug, record] of Object.entries(records)) {
        expect(snapshot.assets[category][key]?.[slug]?.status).toBe(record.status);
      }
    }
  }
  for (const slug of HIDDEN) expect(snapshot.assets.tokens[KEY][slug].status).toBe('disabled');
  expect(snapshot.assets.tokens[KEY][REMOVED].status).toBe('removed');
  expect(snapshot.assets.rwaAdultFlags).toEqual(LEGACY['persist:root.rwas'].adultFlags);

  // Metadata the API cannot re-provide (no TzKT metadata) must survive with its displayed fields.
  for (const [slug, metadata] of Object.entries(LEGACY['persist:temple-root'].tokensMetadata.metadataRecord)) {
    const { name, symbol, decimals, address, id } = metadata as Record<string, unknown>;
    expect(snapshot.metadata.tokensMetadata[slug]).toMatchObject({ name, symbol, decimals, address, id });
  }
  for (const [source, destination] of [
    ['persist:root.collectiblesMetadata', 'collectiblesMetadata'],
    ['persist:root.rwasMetadata', 'rwasMetadata']
  ] as const) {
    for (const record of LEGACY[source].records) {
      expect(snapshot.metadata[destination][`${record.address}_${record.id}`]).toMatchObject({
        address: record.address,
        symbol: record.symbol
      });
    }
  }

  expect(snapshot.balances.isBalancesAdopted).toBe(true);
  for (const [key, entity] of Object.entries(LEGACY['persist:temple-root'].balances.balancesAtomic)) {
    expect(snapshot.balances.legacy[key]).toMatchObject(entity.data);
  }

  // 2.0.9 keys stay byte-identical so a manual republish of 2.0.9 still reads them.
  for (const key of LEGACY_KEYS) expect(s.records[key]).toEqual(LEGACY[key]);
});

it('keeps 2.0.9 choices when /assets reclassifies older tokens and stays stable on restart', async () => {
  const first = boot(JSON.parse(JSON.stringify(LEGACY)));
  await first.request();
  const catalog = Object.keys(legacyAssets.rwas.data[KEY]);
  const loaded = await first.request({
    command: {
      kind: 'assets-loaded',
      category: 'rwas',
      value: { account: ACCOUNT, chainId: TempleChainId.Basenet, slugs: catalog }
    }
  });
  for (const slug of HIDDEN) {
    expect(loaded.assets.rwas[KEY][slug].status).toBe('disabled');
    expect(loaded.assets.tokens[KEY][slug]).toBeUndefined();
  }
  expect(loaded.assets.rwas[KEY][REMOVED].status).toBe('removed');

  // A second 3.0.0 start on the migrated storage must not re-run the migration over newer state.
  const restarted = boot(first.records);
  const snapshot = await restarted.request();
  expect(snapshot.assets).toEqual(loaded.assets);
  expect(snapshot.metadata).toEqual(loaded.metadata);
  for (const key of LEGACY_KEYS) expect(restarted.records[key]).toEqual(LEGACY[key]);
});
