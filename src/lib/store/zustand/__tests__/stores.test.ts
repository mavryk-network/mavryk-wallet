import { BalanceMode } from 'app/store/settings/balance-mode.enum';
import { ABTestGroup } from 'lib/apis/temple/ab-test-group.enum';
import { ALL_PREDEFINED_METADATAS_RECORD } from 'lib/assets/known-tokens';
import { TokenMetadata, TokenStandardsEnum } from 'lib/metadata/types';

import { createAssetsStore } from '../assets.store';
import { awaitStoresHydrated } from '../await-stores-hydrated';
import { commitStagedWrites } from '../destination-store';
import { createMetadataStore } from '../metadata.store';
import { memoryStorage, microtasks } from '../test-support/helpers';
import { createUIStore } from '../ui.store';

const METADATA: TokenMetadata = {
  address: 'KT1custom',
  id: '0',
  name: 'Built metadata',
  symbol: 'ANY',
  decimals: 6,
  standard: TokenStandardsEnum.Fa2,
  thumbnailUri: 'ipfs://thumb',
  displayUri: 'ipfs://display',
  artifactUri: 'ipfs://artifact'
};

describe('inactive destination contracts', () => {
  it('persists validated UI setters without actions, transient fields, or generated identity', async () => {
    const { storage } = memoryStorage();
    const store = createUIStore(storage);
    await awaitStoresHydrated(store);
    expect(store.getState().userId).toBeNull();
    expect(storage.set).not.toHaveBeenCalled();
    const state = store.getState();
    state.setShouldShowNewsletterModal(false);
    state.setUserId('existing-identity');
    state.setAnalyticsEnabled(true);
    state.setBalanceMode(BalanceMode.Gas);
    state.setOnRampPossibility(true);
    state.setAbTestGroupName(ABTestGroup.B);
    state.setLastSeenPromotionName('promotion');
    state.setShouldShowPromotion(true);
    state.setPromotionHidingTimestamps({ banner: 123 });
    state.setIsNewsEnabled(false);
    await store.persistence.flush();
    const expected = {
      shouldShowNewsletterModal: false,
      userId: 'existing-identity',
      isAnalyticsEnabled: true,
      balanceMode: BalanceMode.Gas,
      isOnRampPossibility: true,
      abTestGroupName: ABTestGroup.B,
      lastSeenPromotionName: 'promotion',
      shouldShowPromotion: true,
      promotionHidingTimestamps: { banner: 123 },
      isNewsEnabled: false
    };
    expect(await store.persistence.readBack()).toEqual({ version: 1, state: expected });
    const reloaded = createUIStore(storage);
    await awaitStoresHydrated(reloaded);
    expect(reloaded.getState()).toMatchObject(expected);
    expect(() => state.setPromotionHidingTimestamps({ banner: Infinity })).toThrow();
    expect(() => state.setUserId('bad\nidentity')).toThrow();
    expect(() => state.setBalanceMode('invalid' as BalanceMode)).toThrow();
    expect(() => state.setAbTestGroupName('invalid' as ABTestGroup)).toThrow();
    expect(() => state.setAnalyticsEnabled('true' as unknown as boolean)).toThrow();
    expect(store.getState().balanceMode).toBe(BalanceMode.Gas);
    await store.persistence.dispose();
  });

  it('puts built metadata directly in all categories, including non-staging RWA symbols', async () => {
    const { storage } = memoryStorage();
    const store = createMetadataStore(storage);
    await awaitStoresHydrated(store);
    expect(storage.set).not.toHaveBeenCalled();
    store.getState().putTokenMetadataDirectly('token_0', METADATA);
    store.getState().putCollectibleMetadataDirectly('collectible_0', METADATA);
    store.getState().putRwaMetadataDirectly('rwa_0', METADATA);
    await store.persistence.flush();
    expect((await store.persistence.readBack())?.state).toEqual({
      tokensMetadata: { ...ALL_PREDEFINED_METADATAS_RECORD, token_0: METADATA },
      collectiblesMetadata: { collectible_0: METADATA },
      rwasMetadata: { rwa_0: METADATA }
    });
    const reloaded = createMetadataStore(storage);
    await awaitStoresHydrated(reloaded);
    expect(reloaded.getState().rwasMetadata.rwa_0).toEqual(METADATA);
    expect(typeof reloaded.getState().putRwaMetadataDirectly).toBe('function');
    expect(() => store.getState().putRwaMetadataDirectly('__proto__', METADATA)).toThrow();
    const polluted = JSON.parse(JSON.stringify(METADATA));
    Object.defineProperty(polluted, 'constructor', { value: {}, enumerable: true });
    expect(() => store.getState().putRwaMetadataDirectly('bad', polluted)).toThrow();
    await store.persistence.dispose();
  });

  it('preserves missing predefined metadata while giving stored values precedence', async () => {
    const predefinedSlug = Object.keys(ALL_PREDEFINED_METADATAS_RECORD)[0];
    expect(predefinedSlug).toBeDefined();
    const { storage } = memoryStorage({
      'zustand-metadata': JSON.stringify({
        version: 1,
        state: {
          tokensMetadata: { [predefinedSlug]: METADATA },
          collectiblesMetadata: {},
          rwasMetadata: {}
        }
      })
    });
    const store = createMetadataStore(storage);
    await awaitStoresHydrated(store);
    expect(store.getState().tokensMetadata).toEqual({ ...ALL_PREDEFINED_METADATAS_RECORD, [predefinedSlug]: METADATA });
    expect(storage.set).not.toHaveBeenCalled();
  });

  it('round trips every asset status and optional manual value, with both adult preference records', async () => {
    const { storage } = memoryStorage();
    const store = createAssetsStore(storage);
    await awaitStoresHydrated(store);
    const assets = [
      { account: 'account', chainId: 'chain', slug: 'one', status: 'idle' as const },
      { account: 'account', chainId: 'chain', slug: 'two', status: 'enabled' as const, manual: true },
      { account: 'account', chainId: 'chain', slug: 'three', status: 'disabled' as const, manual: false },
      { account: 'other', chainId: 'other-chain', slug: 'four', status: 'removed' as const }
    ];
    store.getState().putTokensAsIs(assets);
    store.getState().putCollectiblesAsIs(assets);
    store.getState().putRwasAsIs(assets);
    store.getState().setCollectibleAdultFlags({ one: { val: true, ts: 123 } });
    store.getState().setRwaAdultFlags({ two: { val: false, ts: 456 } });
    await store.persistence.flush();
    const persisted = (await store.persistence.readBack())?.state;
    const expected = {
      'account@chain': {
        one: { status: 'idle' },
        two: { status: 'enabled', manual: true },
        three: { status: 'disabled', manual: false }
      },
      'other@other-chain': { four: { status: 'removed' } }
    };
    expect(persisted).toEqual({
      tokens: expected,
      collectibles: expected,
      rwas: expected,
      collectibleAdultFlags: { one: { val: true, ts: 123 } },
      rwaAdultFlags: { two: { val: false, ts: 456 } }
    });
    const reloaded = createAssetsStore(storage);
    await awaitStoresHydrated(reloaded);
    if (!persisted) throw new Error('Missing persisted fixture');
    expect(reloaded.getState()).toMatchObject(persisted);
    expect(() => store.getState().putTokensAsIs([...assets, { ...assets[0], slug: 'constructor' }])).toThrow();
    expect(() => store.getState().setRwaAdultFlags({ bad: { val: true, ts: NaN } })).toThrow();
    await store.persistence.dispose();
  });

  it.each(['metadata', 'assets'])(
    'rejects malformed %s records during real hydration without modifying storage',
    async category => {
      const factory = category === 'metadata' ? createMetadataStore : createAssetsStore;
      const empty = factory(memoryStorage().storage);
      await awaitStoresHydrated(empty);
      const key = empty.persistence.key;
      const base = JSON.parse(JSON.stringify(empty.getState()));
      const invalidValues = [[], { unsafe: [] }, JSON.parse('{"__proto__":{"polluted":true}}')];
      for (const invalid of invalidValues) {
        const state = { ...base, [category === 'metadata' ? 'rwasMetadata' : 'tokens']: invalid };
        const raw = JSON.stringify({ version: 1, state });
        const { storage, records } = memoryStorage({ [key]: raw });
        const destination = factory(storage);
        await expect(awaitStoresHydrated(destination)).rejects.toBeDefined();
        expect(storage.set).not.toHaveBeenCalled();
        expect(records[key]).toBe(raw);
      }
    }
  );

  it('validates durable read-back independently of hydrated memory and rejects writes after disposal', async () => {
    const { storage, records } = memoryStorage();
    const store = createUIStore(storage);
    await awaitStoresHydrated(store);
    store.getState().setUserId('durable-id');
    await store.persistence.flush();
    records['zustand-ui'] = '{corrupt';
    await expect(store.persistence.readBack()).rejects.toThrow();
    expect(store.getState().userId).toBe('durable-id');
    await store.persistence.dispose();
    expect(() => store.getState().setUserId('after-disposal')).toThrow('disposed');
  });

  it('stages all validation before enqueueing writes, rejects stale/duplicate drafts, and commits explicitly', async () => {
    const { storage } = memoryStorage();
    const ui = createUIStore(storage);
    const metadata = createMetadataStore(storage);
    await awaitStoresHydrated(ui, metadata);
    const stagedUI = ui.persistence.prepare(draft => {
      draft.userId = 'migrated-id';
    });
    expect(() =>
      metadata.persistence.prepare(draft => {
        draft.rwasMetadata.bad = { ...METADATA, decimals: NaN };
      })
    ).toThrow();
    await microtasks();
    expect(storage.set).not.toHaveBeenCalled();
    expect(ui.getState().userId).toBeNull();
    const stagedMetadata = metadata.persistence.prepare(draft => {
      draft.rwasMetadata.good = METADATA;
    });
    commitStagedWrites(stagedUI, stagedMetadata);
    await Promise.all([ui.persistence.flush(), metadata.persistence.flush()]);
    expect((await ui.persistence.readBack())?.state.userId).toBe('migrated-id');
    expect((await metadata.persistence.readBack())?.state.rwasMetadata.good).toEqual(METADATA);
    const stale = ui.persistence.prepare(draft => {
      draft.isNewsEnabled = false;
    });
    const untouched = metadata.persistence.prepare(draft => {
      draft.rwasMetadata.another = METADATA;
    });
    ui.getState().setUserId('newer-id');
    expect(() => commitStagedWrites(untouched, stale)).toThrow('Stale');
    expect(metadata.getState().rwasMetadata.another).toBeUndefined();
    const fresh = ui.persistence.prepare(draft => {
      draft.isNewsEnabled = false;
    });
    expect(() => commitStagedWrites(fresh, fresh)).toThrow('one draft');
    expect(ui.getState().isNewsEnabled).toBe(true);
    await Promise.all([ui.persistence.dispose(), metadata.persistence.dispose()]);
  });

  it('flushes the actual store adapter, exposes failures, and verifies the retained snapshot after retry', async () => {
    const { storage } = memoryStorage();
    const originalSet = storage.set;
    const store = createUIStore(storage);
    await awaitStoresHydrated(store);
    storage.set = jest.fn(async () => {
      throw new Error('quota');
    });
    store.getState().setUserId('retained-id');
    await expect(store.persistence.flush()).rejects.toThrow('quota');
    expect(store.persistence.getWriteError()).toEqual(new Error('quota'));
    expect(await store.persistence.readBack()).toBeNull();
    storage.set = originalSet;
    await store.persistence.flush();
    expect((await store.persistence.readBack())?.state.userId).toBe('retained-id');
    await store.persistence.dispose();
  });
});
