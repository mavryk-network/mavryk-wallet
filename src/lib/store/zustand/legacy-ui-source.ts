import { z } from 'zod';

import { TOKEN_METADATA_SCHEMA } from './metadata-state.schema';
import { UI_SCHEMA, UI_PREFERENCES_SCHEMA } from './ui-state.schema';
import {
  assertSafeContainer,
  hasSafeData,
  parseData,
  pickValidRecords,
  RECORD_MAP_SCHEMA,
  reportDroppedLegacyRecords,
  SAFE_KEY_SCHEMA
} from './validation';

export const LEGACY_UI_ROOT_KEY = 'persist:temple-root';
export const ANALYTICS_ID_SCHEMA = UI_SCHEMA.shape.userId.unwrap();
const preferencesSchema = UI_PREFERENCES_SCHEMA.extend({ userId: UI_SCHEMA.shape.userId.optional() });
const PREFERENCE_FIELD_SCHEMAS = new Map<string, z.ZodTypeAny>(Object.entries(preferencesSchema.shape));
const UI_SLICES = ['settings', 'abTesting', 'newsletter', 'notifications', 'advertising', 'tokensMetadata'] as const;

/** Decode a redux-persist root to its container; slices stay serialized until a caller selects them. */
function decodeRoot(raw: unknown): Record<string, unknown> {
  const root = RECORD_MAP_SCHEMA.parse(typeof raw === 'string' ? JSON.parse(raw) : raw);
  assertSafeContainer(root);
  return root;
}

/** redux-persist serializes each slice separately; a non-string slice is already decoded. */
const decodeSlice = (value: unknown): unknown => (typeof value === 'string' ? JSON.parse(value) : value);

/**
 * Decode only the named slices of a redux-persist root and check each one shallowly. Slice contents are not checked
 * here: callers validate every field and record they migrate, so unsafe content anywhere else (an ad payload, another
 * token's metadata) cannot block a migration.
 *
 * @param raw the serialized or decoded root
 * @param keys the slices the caller migrates
 * @returns the present slices, decoded
 */
export function decodeLegacySlices<K extends string>(raw: unknown, keys: readonly K[]): Partial<Record<K, unknown>> {
  const root = decodeRoot(raw);
  const slices: Partial<Record<K, unknown>> = {};
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(root, key)) continue;
    const value = decodeSlice(root[key]);
    assertSafeContainer(value);
    slices[key] = value;
  }
  return slices;
}

/**
 * Decode every slice for Redux rehydration. Redux keeps whole slices, so each one is checked deeply; a slice with an
 * unsafe key or an over-deep value is dropped (Redux keeps that slice's initial state) instead of blocking startup.
 * Synthetic fixtures mirror inspected Redux serialize:false shapes; no source object is merged into a destination.
 */
export function decodeLegacyUIRoot(raw: unknown): Record<string, unknown> {
  const root = decodeRoot(raw);
  const decoded: Record<string, unknown> = {};
  let dropped = 0;
  for (const key of Object.keys(root)) {
    const value = decodeSlice(root[key]);
    if (SAFE_KEY_SCHEMA.safeParse(key).success && hasSafeData(value)) decoded[key] = value;
    else dropped++;
  }
  reportDroppedLegacyRecords('Redux slice', dropped);
  return decoded;
}

/** Select only the Phase 3 fields; every other slice and field of the root is never decoded or checked. */
export function parseLegacyUIRoot(raw: unknown) {
  const decoded = decodeLegacySlices(raw, UI_SLICES);
  const slices: Partial<Record<(typeof UI_SLICES)[number], Record<string, unknown>>> = {};
  for (const key of UI_SLICES) {
    if (Object.prototype.hasOwnProperty.call(decoded, key)) slices[key] = RECORD_MAP_SCHEMA.parse(decoded[key]);
  }
  const values: Record<string, unknown> = {};
  const copy = (slice: (typeof UI_SLICES)[number], field: string, target = field) => {
    const source = slices[slice];
    if (source && Object.prototype.hasOwnProperty.call(source, field)) values[target] = source[field];
  };
  for (const field of ['userId', 'isAnalyticsEnabled', 'balanceMode', 'isOnRampPossibility']) copy('settings', field);
  copy('abTesting', 'groupName', 'abTestGroupName');
  copy('newsletter', 'shouldShowNewsletterModal');
  copy('notifications', 'isNewsEnabled');
  copy('advertising', 'lastSeenPromotionName');
  let dropped = 0;
  const onDrop = () => void dropped++;
  // Each preference is validated on its own: an invalid one keeps its destination default instead of blocking unlock.
  const preferences = parseData(
    preferencesSchema,
    Object.fromEntries(
      Object.entries(values).filter(([field, value]) => {
        const isValid = PREFERENCE_FIELD_SCHEMAS.get(field)?.safeParse(value).success === true;
        if (!isValid) onDrop();
        return isValid;
      })
    )
  );
  const metadata = slices.tokensMetadata
    ? pickValidRecords(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA, slices.tokensMetadata.metadataRecord, onDrop)
    : {};
  reportDroppedLegacyRecords('preference/metadata', dropped);
  // Fiat currency, privacy, caches, nested assets/adult flags/promotion, collectible/RWA metadata stay with their owners.
  return { preferences, metadata };
}
