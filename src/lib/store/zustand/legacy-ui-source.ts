import { z } from 'zod';

import { TOKEN_METADATA_SCHEMA } from './metadata-state.schema';
import { UI_SCHEMA, UI_PREFERENCES_SCHEMA } from './ui-state.schema';
import { assertSafeData, parseData, pickValidRecords, reportDroppedLegacyRecords, SAFE_KEY_SCHEMA } from './validation';

export const LEGACY_UI_ROOT_KEY = 'persist:temple-root';
export const ANALYTICS_ID_SCHEMA = UI_SCHEMA.shape.userId.unwrap();
const preferencesSchema = UI_PREFERENCES_SCHEMA.extend({ userId: UI_SCHEMA.shape.userId.optional() });
const PREFERENCE_FIELD_SCHEMAS = new Map<string, z.ZodTypeAny>(Object.entries(preferencesSchema.shape));
const objectSchema = z.record(z.unknown());

/** Decode only supported object roots/slices; absence is handled by the caller, never by parse failure. */
function decodeObject(raw: unknown): Record<string, unknown> {
  return parseData(objectSchema, typeof raw === 'string' ? JSON.parse(raw) : raw);
}

/** Synthetic fixtures mirror inspected Redux serialize:false shapes; no source object is merged into a destination. */
export function decodeLegacyUIRoot(raw: unknown): Record<string, unknown> {
  const root = decodeObject(raw);
  const decoded: Record<string, unknown> = {};
  for (const key of Object.keys(root)) {
    const rawValue = root[key];
    const value = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    assertSafeData(value);
    decoded[key] = value;
  }
  return decoded;
}

/** Select only the Phase 3 fields after decoding and validating the complete source graph. */
export function parseLegacyUIRoot(raw: unknown) {
  const root = decodeLegacyUIRoot(raw);
  const slices: Record<string, Record<string, unknown>> = {};
  for (const key of ['settings', 'abTesting', 'newsletter', 'notifications', 'advertising', 'tokensMetadata']) {
    if (Object.prototype.hasOwnProperty.call(root, key)) slices[key] = parseData(objectSchema, root[key]);
  }
  const values: Record<string, unknown> = {};
  const copy = (slice: string, field: string, target = field) => {
    if (slices[slice] && Object.prototype.hasOwnProperty.call(slices[slice], field)) {
      values[target] = slices[slice][field];
    }
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
