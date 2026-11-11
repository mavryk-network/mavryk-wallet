import BigNumber from 'bignumber.js';
import { z } from 'zod';

import { tokenToSlug } from 'lib/assets';

import { ADULT_FLAGS_SCHEMA, STORED_ASSET_SCHEMA } from './assets-state.schema';
import { decodeLegacyUIRoot } from './legacy-ui-source';
import { TOKEN_METADATA_SCHEMA } from './metadata-state.schema';
import { BrowserStorage } from './persist-storage';
import { UI_SCHEMA } from './ui-state.schema';
import { parseData, pickValidRecords, reportDroppedLegacyRecords, SAFE_KEY_SCHEMA } from './validation';

export const LEGACY_ASSETS_KEYS = [
  'persist:root.assets',
  'persist:root.collectibles',
  'persist:root.rwas',
  'persist:root.partnersPromotion',
  'persist:root.collectiblesMetadata',
  'persist:root.rwasMetadata'
] as const;
export type LegacyAssetsKey = (typeof LEGACY_ASSETS_KEYS)[number];
const ASSET_KEY_SCHEMA = SAFE_KEY_SCHEMA.refine(value => /^[^@]+@[^@]+$/.test(value));
const sliceSchema = z.object({ data: z.unknown() });
const sourceSchema = z.object({ tokens: sliceSchema, collectibles: sliceSchema, rwas: sliceSchema });
const flagsSchema = z.object({ adultFlags: z.unknown() });
const promotionSchema = UI_SCHEMA.pick({ shouldShowPromotion: true }).extend({
  promotionHidingTimestamps: z.unknown()
});
const metadataSchema = z.object({ records: z.array(z.unknown()) });
const LEGACY_METADATA_SCHEMA = TOKEN_METADATA_SCHEMA.refine(metadata => {
  const id = new BigNumber(metadata.id);
  return metadata.address.length > 0 && id.isInteger() && id.gte(0);
}, 'Invalid legacy metadata identifier');
const ADULT_FLAG_SCHEMA = ADULT_FLAGS_SCHEMA.valueSchema;
const TIMESTAMP_SCHEMA = UI_SCHEMA.shape.promotionHidingTimestamps.valueSchema;

/**
 * Decode all six sources before preparing any writes. A present slice with a corrupt structure fails closed; invalid
 * individual records (fetched third-party content) are skipped so they can never lock the wallet after an update.
 */
export function parseLegacyAssetsSources(raw: Partial<Record<LegacyAssetsKey, unknown>>) {
  let dropped = 0;
  const onDrop = () => void dropped++;
  const decode = (key: LegacyAssetsKey) => (raw[key] === undefined ? undefined : decodeLegacyUIRoot(raw[key]));
  const assets = decode(LEGACY_ASSETS_KEYS[0]);
  const collectibles = decode(LEGACY_ASSETS_KEYS[1]);
  const rwas = decode(LEGACY_ASSETS_KEYS[2]);
  const promotion = decode(LEGACY_ASSETS_KEYS[3]);
  const parseAssetRecords = (data: unknown) => {
    const accounts = pickValidRecords(ASSET_KEY_SCHEMA, z.record(z.unknown()), data, onDrop);
    return Object.fromEntries(
      Object.entries(accounts).map(([key, records]) => [
        key,
        pickValidRecords(SAFE_KEY_SCHEMA, STORED_ASSET_SCHEMA, records, onDrop)
      ])
    );
  };
  const convertMetadata = (key: LegacyAssetsKey) => {
    const decoded = decode(key);
    const records: Record<string, z.infer<typeof TOKEN_METADATA_SCHEMA>> = {};
    if (decoded !== undefined) {
      for (const item of parseData(metadataSchema, decoded).records) {
        const metadata = LEGACY_METADATA_SCHEMA.safeParse(item);
        const slug = metadata.success ? SAFE_KEY_SCHEMA.safeParse(tokenToSlug(metadata.data)) : undefined;
        // Match the legacy Map conversion: the last occurrence of a slug wins.
        if (metadata.success && slug?.success) records[slug.data] = metadata.data;
        else onDrop();
      }
    }
    return records;
  };
  const assetSlices = assets === undefined ? undefined : parseData(sourceSchema, assets);
  const promotionSlice = promotion === undefined ? undefined : parseData(promotionSchema, promotion);
  const result = {
    assets: assetSlices && {
      tokens: { data: parseAssetRecords(assetSlices.tokens.data) },
      collectibles: { data: parseAssetRecords(assetSlices.collectibles.data) },
      rwas: { data: parseAssetRecords(assetSlices.rwas.data) }
    },
    collectibleAdultFlags:
      collectibles === undefined
        ? {}
        : pickValidRecords(SAFE_KEY_SCHEMA, ADULT_FLAG_SCHEMA, parseData(flagsSchema, collectibles).adultFlags, onDrop),
    rwaAdultFlags:
      rwas === undefined
        ? {}
        : pickValidRecords(SAFE_KEY_SCHEMA, ADULT_FLAG_SCHEMA, parseData(flagsSchema, rwas).adultFlags, onDrop),
    promotion: promotionSlice && {
      shouldShowPromotion: promotionSlice.shouldShowPromotion,
      promotionHidingTimestamps: pickValidRecords(
        SAFE_KEY_SCHEMA,
        TIMESTAMP_SCHEMA,
        promotionSlice.promotionHidingTimestamps,
        onDrop
      )
    },
    collectiblesMetadata: convertMetadata(LEGACY_ASSETS_KEYS[4]),
    rwasMetadata: convertMetadata(LEGACY_ASSETS_KEYS[5])
  };
  reportDroppedLegacyRecords('asset', dropped);
  return result;
}

/** Browser reads must succeed with absence before the foreground may inspect a serialized fallback. */
export async function readLegacyAssetsSource(
  key: LegacyAssetsKey,
  storage: BrowserStorage,
  readFallback: (key: LegacyAssetsKey) => Promise<string | null>
): Promise<unknown> {
  const result = await storage.get(key);
  if (result[key] !== undefined) return result[key];
  const fallback = await readFallback(key);
  return fallback === null ? undefined : fallback;
}
