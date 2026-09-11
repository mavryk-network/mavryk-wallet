import { z } from 'zod';

import { SAFE_KEY_SCHEMA } from './validation';

export const STORED_ASSET_SCHEMA = z.object({
  status: z.enum(['idle', 'enabled', 'disabled', 'removed']),
  manual: z.boolean().optional()
});
export const ASSET_TO_PUT_SCHEMA = STORED_ASSET_SCHEMA.extend({
  slug: SAFE_KEY_SCHEMA,
  account: SAFE_KEY_SCHEMA.refine(value => !value.includes('@')),
  chainId: SAFE_KEY_SCHEMA.refine(value => !value.includes('@'))
});
export const ASSET_RECORDS_SCHEMA = z.record(
  SAFE_KEY_SCHEMA.refine(value => /^[^@]+@[^@]+$/.test(value)),
  z.record(SAFE_KEY_SCHEMA, STORED_ASSET_SCHEMA)
);
export const ADULT_FLAGS_SCHEMA = z.record(SAFE_KEY_SCHEMA, z.object({ val: z.boolean(), ts: z.number().finite() }));
export const ASSETS_SCHEMA = z.object({
  tokens: ASSET_RECORDS_SCHEMA,
  collectibles: ASSET_RECORDS_SCHEMA,
  rwas: ASSET_RECORDS_SCHEMA,
  collectibleAdultFlags: ADULT_FLAGS_SCHEMA,
  rwaAdultFlags: ADULT_FLAGS_SCHEMA
});

export type AssetsState = z.infer<typeof ASSETS_SCHEMA>;
