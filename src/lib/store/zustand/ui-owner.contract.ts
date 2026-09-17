import { z } from 'zod';

import { ASSETS_COMMAND_SCHEMA } from './assets-command';
import { ASSETS_SCHEMA } from './assets-state.schema';
import { LEGACY_ASSETS_KEYS } from './legacy-assets-source';
import { METADATA_SCHEMA, TOKEN_METADATA_SCHEMA } from './metadata-state.schema';
import { UI_SCHEMA, UI_PREFERENCES_SCHEMA } from './ui-state.schema';
import { SAFE_KEY_SCHEMA } from './validation';

export const UI_OWNER_CHANNEL = 'task11-ui-owner';
export const UI_COMMAND_SCHEMA = z.union([
  z.object({ kind: z.literal('indexeddb-assets-migration') }).strict(),
  ASSETS_COMMAND_SCHEMA,
  z
    .object({
      kind: z.literal('preferences'),
      values: UI_PREFERENCES_SCHEMA.extend({
        // null is an explicit wire-level clear; JSON messages omit undefined properties.
        lastSeenPromotionName: UI_SCHEMA.shape.lastSeenPromotionName.unwrap().nullable().optional()
      }).strict()
    })
    .strict(),
  z
    .object({
      kind: z.literal('metadata'),
      mode: z.enum(['put', 'whitelist', 'refresh']),
      records: z.record(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA)
    })
    .strict()
]);
export type UICommand = z.infer<typeof UI_COMMAND_SCHEMA>;
export const UI_SNAPSHOT_SCHEMA = z.object({ ui: UI_SCHEMA, metadata: METADATA_SCHEMA, assets: ASSETS_SCHEMA });
export type UISnapshot = z.infer<typeof UI_SNAPSHOT_SCHEMA>;
export const UI_REQUEST_SCHEMA = z
  .object({
    channel: z.literal(UI_OWNER_CHANNEL),
    fallback: z.string().nullable().optional(),
    assetsFallback: z.record(z.enum(LEGACY_ASSETS_KEYS), z.string().nullable()).optional(),
    command: UI_COMMAND_SCHEMA.optional()
  })
  .strict();
