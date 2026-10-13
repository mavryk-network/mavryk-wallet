import { z } from 'zod';

import { WHITELIST_METADATA_SCOPE_KEY } from 'lib/metadata/metadata-scope';

import { applyAssetsCommand } from './assets-command';
import { ASSET_TO_PUT_SCHEMA } from './assets-state.schema';
import { applyMetadataRecords } from './metadata-command';
import { TOKEN_METADATA_SCHEMA, METADATA_SCOPE_KEY_SCHEMA } from './metadata-state.schema';
import { SCAMLIST_SCHEMA, WHITELIST_SCHEMA } from './security-state.schema';
import { SAFE_KEY_SCHEMA } from './validation';

const requestSchema = z.object({ requestKey: SAFE_KEY_SCHEMA, requestId: SAFE_KEY_SCHEMA });
const metadataSchema = z.record(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA);
export const ASSETS_SYNC_COMMAND_SCHEMA = z.union([
  requestSchema.extend({ kind: z.literal('assets-sync-start') }).strict(),
  requestSchema
    .extend({
      kind: z.literal('assets-sync'),
      category: z.enum(['tokens', 'collectibles', 'rwas']),
      value: ASSET_TO_PUT_SCHEMA.pick({ account: true, chainId: true }).extend({ slugs: z.array(SAFE_KEY_SCHEMA) }),
      scopeKey: METADATA_SCOPE_KEY_SCHEMA.optional(),
      metadata: metadataSchema
    })
    .strict(),
  requestSchema.extend({ kind: z.literal('scamlist-sync'), data: SCAMLIST_SCHEMA }).strict(),
  requestSchema.extend({ kind: z.literal('whitelist-sync'), data: WHITELIST_SCHEMA, metadata: metadataSchema }).strict()
]);

/** Serialize overlapping foreground responses before touching records, security or coupled metadata. */
export function applyAssetsSyncCommand(
  command: z.infer<typeof ASSETS_SYNC_COMMAND_SCHEMA>,
  stores: Parameters<typeof applyAssetsCommand>[1],
  metadataRevision?: number
) {
  const { assets, metadata } = stores;
  if (command.kind === 'assets-sync-start') {
    assets.persistence
      .prepare(draft => {
        draft.syncRequests[command.requestKey] = command.requestId;
      })
      .commit();
    return;
  }
  if (assets.getState().syncRequests[command.requestKey] !== command.requestId) return;
  if (command.kind === 'assets-sync') {
    applyAssetsCommand({ kind: 'assets-loaded', category: command.category, value: command.value }, stores);
  } else {
    assets.persistence
      .prepare(draft => {
        if (command.kind === 'scamlist-sync') draft.mainnetScamlist = command.data;
        else draft.mainnetWhitelist = Array.from(new Set([...(draft.mainnetWhitelist ?? []), ...command.data]));
      })
      .commit();
    if (command.kind === 'scamlist-sync') return;
  }
  metadata.persistence
    .prepare(draft => {
      applyMetadataRecords(
        draft,
        command.kind === 'assets-sync' ? command.category : 'tokens',
        command.metadata,
        command.kind === 'whitelist-sync' ? 'whitelist' : 'put',
        command.kind === 'assets-sync' ? command.scopeKey : WHITELIST_METADATA_SCOPE_KEY,
        metadataRevision
      );
    })
    .commit();
}
