import isEqual from 'lodash/isEqual';

import { ASSETS_SCHEMA } from './assets-state.schema';
import type { createAssetsStore } from './assets.store';
import { awaitStoresHydrated } from './await-stores-hydrated';
import { commitStagedWrites } from './destination-store';
import {
  LEGACY_ASSETS_KEYS,
  LegacyAssetsKey,
  parseLegacyAssetsSources,
  readLegacyAssetsSource
} from './legacy-assets-source';
import { METADATA_SCHEMA } from './metadata-state.schema';
import type { createMetadataStore } from './metadata.store';
import { BrowserStorage } from './persist-storage';
import { UI_SCHEMA } from './ui-state.schema';
import type { createUIStore } from './ui.store';

/** One background-owned attempt; intact legacy values win matching keys until independently verified completion. */
export function createLegacyAssetsMigration(options: {
  ui: ReturnType<typeof createUIStore>;
  metadata: ReturnType<typeof createMetadataStore>;
  assets: ReturnType<typeof createAssetsStore>;
  storage: BrowserStorage;
  readFallback: (key: LegacyAssetsKey) => Promise<string | null>;
}) {
  const { ui, metadata, assets, storage } = options;
  let attempt: Promise<void> | undefined;
  let isReady = false;
  const run = async () => {
    for (const store of [ui, metadata, assets]) {
      if (store.hydration.getError() !== undefined) await store.hydration.retry();
    }
    await awaitStoresHydrated(ui, metadata, assets);
    const [durableUI, durableMetadata, durableAssets] = await Promise.all([
      ui.persistence.readBack(),
      metadata.persistence.readBack(),
      assets.persistence.readBack()
    ]);
    if (!durableUI?.state.legacyMigrated) throw new Error('Task 11 must complete before nested migration');
    if (durableUI.state.legacyAssetsMigrated) {
      if (!durableMetadata || !durableAssets) throw new Error('Nested migration destinations missing');
      isReady = true;
      return;
    }
    const raw: Partial<Record<LegacyAssetsKey, unknown>> = {};
    for (const key of LEGACY_ASSETS_KEYS) {
      raw[key] = await readLegacyAssetsSource(key, storage, options.readFallback);
    }
    const source = parseLegacyAssetsSources(raw);
    const assetsDraft = assets.persistence.prepare(draft => {
      for (const category of ['tokens', 'collectibles', 'rwas'] as const) {
        for (const [key, records] of Object.entries(source.assets?.[category].data ?? {})) {
          draft[category][key] = { ...draft[category][key], ...records };
        }
      }
      Object.assign(draft.collectibleAdultFlags, source.collectibleAdultFlags);
      Object.assign(draft.rwaAdultFlags, source.rwaAdultFlags);
    });
    const metadataDraft = metadata.persistence.prepare(draft => {
      Object.assign(draft.collectiblesMetadata, source.collectiblesMetadata);
      Object.assign(draft.rwasMetadata, source.rwasMetadata);
    });
    const uiDraft = ui.persistence.prepare(draft => {
      if (source.promotion) {
        draft.shouldShowPromotion = source.promotion.shouldShowPromotion;
        Object.assign(draft.promotionHidingTimestamps, source.promotion.promotionHidingTimestamps);
      }
      draft.legacyAssetsMigrated = false;
    });
    commitStagedWrites(assetsDraft, metadataDraft, uiDraft);
    const expected = JSON.parse(
      JSON.stringify({
        ui: UI_SCHEMA.parse(ui.getState()),
        metadata: METADATA_SCHEMA.parse(metadata.getState()),
        assets: ASSETS_SCHEMA.parse(assets.getState())
      })
    );
    await Promise.all([assets.persistence.flush(), metadata.persistence.flush(), ui.persistence.flush()]);
    const written = await Promise.all([
      ui.persistence.readBack(),
      metadata.persistence.readBack(),
      assets.persistence.readBack()
    ]);
    if (
      !isEqual(
        written.map(value => value?.state),
        [expected.ui, expected.metadata, expected.assets]
      )
    ) {
      throw new Error('Nested migration durable read-back failed');
    }
    ui.persistence
      .prepare(draft => {
        draft.legacyAssetsMigrated = true;
      })
      .commit();
    await ui.persistence.flush();
    expected.ui.legacyAssetsMigrated = true;
    if (!isEqual((await ui.persistence.readBack())?.state, expected.ui))
      throw new Error('Nested completion read-back failed');
    isReady = true;
  };
  return {
    isReady: () => isReady,
    initialize(): Promise<void> {
      if (isReady) return Promise.resolve();
      if (!attempt)
        attempt = run().finally(() => {
          attempt = undefined;
        });
      return attempt;
    }
  };
}
