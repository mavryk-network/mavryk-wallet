import BigNumber from 'bignumber.js';
import { z } from 'zod';

import { tokenToSlug } from 'lib/assets';

import { ADULT_FLAGS_SCHEMA, ASSET_RECORDS_SCHEMA } from './assets-state.schema';
import { decodeLegacyUIRoot } from './legacy-ui-source';
import { TOKEN_METADATA_SCHEMA } from './metadata-state.schema';
import { BrowserStorage } from './persist-storage';
import { UI_SCHEMA } from './ui-state.schema';
import { parseData, SAFE_KEY_SCHEMA } from './validation';

export const LEGACY_ASSETS_KEYS = [
  'persist:root.assets',
  'persist:root.collectibles',
  'persist:root.rwas',
  'persist:root.partnersPromotion',
  'persist:root.collectiblesMetadata',
  'persist:root.rwasMetadata'
] as const;
export type LegacyAssetsKey = (typeof LEGACY_ASSETS_KEYS)[number];
const sourceSchema = z.object({
  tokens: z.object({ data: ASSET_RECORDS_SCHEMA }),
  collectibles: z.object({ data: ASSET_RECORDS_SCHEMA }),
  rwas: z.object({ data: ASSET_RECORDS_SCHEMA })
});
const flagsSchema = z.object({ adultFlags: ADULT_FLAGS_SCHEMA });
const promotionSchema = UI_SCHEMA.pick({ shouldShowPromotion: true, promotionHidingTimestamps: true });
const metadataSchema = z.object({
  records: z.array(
    TOKEN_METADATA_SCHEMA.refine(metadata => {
      const id = new BigNumber(metadata.id);
      return metadata.address.length > 0 && id.isInteger() && id.gte(0);
    }, 'Invalid legacy metadata identifier')
  )
});

/** Decode all six sources before preparing any writes. Present incomplete/malformed slices fail closed. */
export function parseLegacyAssetsSources(raw: Partial<Record<LegacyAssetsKey, unknown>>) {
  const decode = (key: LegacyAssetsKey) => (raw[key] === undefined ? undefined : decodeLegacyUIRoot(raw[key]));
  const assets = decode(LEGACY_ASSETS_KEYS[0]);
  const collectibles = decode(LEGACY_ASSETS_KEYS[1]);
  const rwas = decode(LEGACY_ASSETS_KEYS[2]);
  const promotion = decode(LEGACY_ASSETS_KEYS[3]);
  const convertMetadata = (key: LegacyAssetsKey) => {
    const decoded = decode(key);
    const records: Record<string, z.infer<typeof TOKEN_METADATA_SCHEMA>> = {};
    if (decoded !== undefined) {
      for (const metadata of parseData(metadataSchema, decoded).records) {
        // Match the legacy Map conversion: the last occurrence of a slug wins.
        records[parseData(SAFE_KEY_SCHEMA, tokenToSlug(metadata))] = metadata;
      }
    }
    return records;
  };
  return {
    assets: assets === undefined ? undefined : parseData(sourceSchema, assets),
    collectibleAdultFlags: collectibles === undefined ? {} : parseData(flagsSchema, collectibles).adultFlags,
    rwaAdultFlags: rwas === undefined ? {} : parseData(flagsSchema, rwas).adultFlags,
    promotion: promotion === undefined ? undefined : parseData(promotionSchema, promotion),
    collectiblesMetadata: convertMetadata(LEGACY_ASSETS_KEYS[4]),
    rwasMetadata: convertMetadata(LEGACY_ASSETS_KEYS[5])
  };
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
