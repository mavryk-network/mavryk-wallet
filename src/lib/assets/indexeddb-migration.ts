import type Dexie from 'dexie';
import isEqual from 'lodash/isEqual';
import { z } from 'zod';

import { isCollectible, isRwa } from 'lib/metadata/classification';
import type { TokenMetadata } from 'lib/metadata/types';
import { ASSETS_SCHEMA, ASSET_TO_PUT_SCHEMA } from 'lib/store/zustand/assets-state.schema';
import type { assetsStore } from 'lib/store/zustand/assets.store';
import { awaitStoresHydrated } from 'lib/store/zustand/await-stores-hydrated';
import { METADATA_SCHEMA, TOKEN_METADATA_SCHEMA } from 'lib/store/zustand/metadata-state.schema';
import type { metadataStore } from 'lib/store/zustand/metadata.store';
import { UI_SCHEMA } from 'lib/store/zustand/ui-state.schema';
import type { uiStore } from 'lib/store/zustand/ui.store';
import { parseData, SAFE_KEY_SCHEMA } from 'lib/store/zustand/validation';

import { getAccountAssetsStoreKey } from './account-assets-key';

const sourceSchema = z
  .object({
    account: ASSET_TO_PUT_SCHEMA.shape.account,
    chainId: ASSET_TO_PUT_SCHEMA.shape.chainId,
    tokenSlug: SAFE_KEY_SCHEMA,
    status: z.number().int().min(0).max(3),
    addedAt: z.number().finite().nonnegative(),
    manual: z.boolean().optional(),
    latestBalance: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .optional(),
    latestUSDBalance: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .optional(),
    order: z.number().int().nonnegative().optional(),
    type: z.number().int().min(0).max(1).optional()
  })
  .strict();
export type IndexedDBAsset = z.infer<typeof sourceSchema>;
const categories = ['collectibles', 'rwas', 'tokens'] as const;
const statuses = ['idle', 'enabled', 'disabled', 'removed'] as const;

/** Runs only inside the background owner's queue. Cleanup uses the original out-of-line keys and values. */
export async function migrateIndexedDBAssets(options: {
  table: Dexie.Table<unknown, string>;
  assets: typeof assetsStore;
  metadata: typeof metadataStore;
  ui: typeof uiStore;
  fetchMetadata: (record: IndexedDBAsset) => Promise<TokenMetadata | undefined>;
}) {
  const { table, assets, metadata, ui } = options;
  await awaitStoresHydrated(ui, metadata, assets);
  if (!ui.getState().legacyMigrated || !ui.getState().legacyAssetsMigrated)
    throw new Error('Legacy migrations must complete before IndexedDB migration');

  // A read failure is never an empty source. Keys and values come from the same transaction.
  const snapshot: { key: unknown; raw: unknown }[] = [];
  await table.db.transaction('r', table, async () => {
    await table.each((raw, cursor) => {
      snapshot.push({ key: cursor.primaryKey, raw });
    });
  });
  // Validate outside Dexie's cursor callback so validation failures cannot be swallowed by cursor iteration.
  const source = snapshot.map(({ key, raw }) => ({
    key: parseData(SAFE_KEY_SCHEMA, key),
    raw,
    record: parseData(sourceSchema, raw)
  }));
  if (!source.length) return;

  const expectedUI = parseData(UI_SCHEMA, ui.getState());
  const expectedMetadata = parseData(METADATA_SCHEMA, metadata.getState());
  const expectedAssets = parseData(ASSETS_SCHEMA, assets.getState());
  const seen = new Map<string, { status: number; manual?: boolean }>();
  for (const { record } of source) {
    const { account, chainId, tokenSlug: slug, status, manual } = record;
    const key = getAccountAssetsStoreKey(account, chainId);
    const tuple = JSON.stringify([account, chainId, slug]);
    const choice = { status, manual };
    if (seen.has(tuple) && !isEqual(seen.get(tuple), choice)) throw new Error('Conflicting IndexedDB asset records');
    seen.set(tuple, choice);
    // Any current category wins, including removed status and absent manual. Never introduce a second category.
    if (categories.some(category => expectedAssets[category][key]?.[slug])) continue;
    const restored = [
      expectedMetadata.collectiblesMetadata[slug],
      expectedMetadata.rwasMetadata[slug],
      expectedMetadata.tokensMetadata[slug]
    ].filter((value): value is TokenMetadata => !!value);
    if (!restored.length) {
      let fetched: TokenMetadata | undefined;
      try {
        fetched = await options.fetchMetadata(record);
      } catch {
        // Network failure is an explicit classification fallback; no source record is discarded.
        fetched = undefined;
      }
      if (fetched) restored.push(parseData(TOKEN_METADATA_SCHEMA, fetched));
    }
    const category = restored.some(isCollectible) ? 'collectibles' : restored.some(isRwa) ? 'rwas' : 'tokens';
    const records = expectedAssets[category][key] ?? (expectedAssets[category][key] = {});
    records[slug] = { status: statuses[status]!, manual: manual ?? false };
  }
  // Validate the complete detached plan before accepting a write. Fetched metadata is classification-only:
  // the slug-only metadata destination cannot safely hold different networks' fetched values.
  const draft = assets.persistence.prepare(value => Object.assign(value, expectedAssets));
  draft.commit();
  await Promise.all([assets.persistence.flush(), metadata.persistence.flush(), ui.persistence.flush()]);
  const durable = await Promise.all([
    ui.persistence.readBack(),
    metadata.persistence.readBack(),
    assets.persistence.readBack()
  ]);
  const expected = JSON.parse(JSON.stringify([expectedUI, expectedMetadata, expectedAssets]));
  if (
    !isEqual(
      durable.map(value => value?.state),
      expected
    )
  )
    throw new Error('IndexedDB destination verification failed');

  // No browser-storage await inside this transaction. A changed/new row survives; abort rolls back all deletes.
  await table.db.transaction('rw', table, async () => {
    for (const { key, raw } of source) {
      if (isEqual(await table.get(key), raw)) await table.delete(key);
    }
    if (await table.count()) throw new Error('IndexedDB source changed; retry migration');
  });
}
