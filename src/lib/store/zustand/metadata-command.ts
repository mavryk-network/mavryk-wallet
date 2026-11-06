import { z } from 'zod';

import { MetadataCategory, MetadataMode } from 'lib/metadata/metadata-scope';
import { TokenMetadata } from 'lib/metadata/types';

import { MetadataState, METADATA_RECORD_SCHEMA, METADATA_SCOPE_KEY_SCHEMA } from './metadata-state.schema';
import { SAFE_KEY_SCHEMA } from './validation';

const request = { requestId: SAFE_KEY_SCHEMA, scopeKey: METADATA_SCOPE_KEY_SCHEMA };
export const METADATA_COMMAND_SCHEMA = z.union([
  z.object({ kind: z.literal('metadata-sync-start'), ...request }).strict(),
  z.object({ kind: z.literal('metadata-sync-cancel'), requestId: SAFE_KEY_SCHEMA }).strict(),
  z
    .object({
      kind: z.literal('metadata-sync'),
      ...request,
      category: z.enum(['tokens', 'collectibles', 'rwas']),
      mode: z.enum(['put', 'whitelist', 'refresh']),
      records: METADATA_RECORD_SCHEMA
    })
    .strict(),
  z
    .object({
      kind: z.literal('metadata-save'),
      scopeKey: METADATA_SCOPE_KEY_SCHEMA,
      category: z.enum(['tokens', 'collectibles', 'rwas']),
      records: METADATA_RECORD_SCHEMA
    })
    .strict()
]);

/** Owner-issued ordering, independent of foreground clocks and preserved across restart. */
export function reserveMetadataRevision(draft: MetadataState) {
  draft.revision = (draft.revision ?? 0) + 1;
  return draft.revision;
}

/** Apply one validated update against current owner state; misses never erase saved metadata. */
export function applyMetadataRecords(
  draft: MetadataState,
  category: MetadataCategory,
  records: Record<string, TokenMetadata>,
  mode: MetadataMode,
  scopeKey?: string,
  revision = reserveMetadataRevision(draft)
) {
  const field = `${category}Metadata` as const;
  const scoped = scopeKey
    ? ((draft.scoped ??= {})[scopeKey] ??= {
        tokensMetadata: {},
        collectiblesMetadata: {},
        rwasMetadata: {},
        revisions: {}
      })
    : undefined;
  const destination = scoped ? scoped[field] : draft[field];
  let isComplete = true;
  for (const [slug, metadata] of Object.entries(records)) {
    const key = JSON.stringify([category, slug]);
    if (scoped && (scoped.revisions[key] ?? 0) > revision) {
      isComplete = false;
      continue;
    }
    const current = destination[slug] ?? draft[field][slug];
    if (mode === 'whitelist' && current) continue;
    if (mode === 'refresh') {
      if (!current) continue;
      destination[slug] = { ...current, artifactUri: metadata.artifactUri, displayUri: metadata.displayUri };
    } else destination[slug] = metadata;
    if (scoped) scoped.revisions[key] = revision;
  }
  return isComplete;
}
