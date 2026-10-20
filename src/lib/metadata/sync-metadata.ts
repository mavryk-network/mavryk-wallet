import { CancelledError } from '@tanstack/react-query';
import { z } from 'zod';

import { fromAssetSlug } from 'lib/assets/utils';
import { TOKEN_METADATA_SCHEMA } from 'lib/store/zustand/metadata-state.schema';
import { requestOwnedUISnapshot, updateOwnedUI } from 'lib/store/zustand/ui-client';
import { parseData } from 'lib/store/zustand/validation';

import { FetchedMetadataRecord } from './fetch';
import { getMetadataScopeKey, MetadataCategory, MetadataMode, MetadataScope } from './metadata-scope';
import { TokenMetadata } from './types';
import { buildTokenMetadataFromFetched } from './utils';

const responseSchema = z.object({
  decimals: z.number().finite().int().nonnegative(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  thumbnailUri: z.string().optional(),
  displayUri: z.string().optional(),
  artifactUri: z.string().optional()
});

/** Validate the entire response before publishing any record; null alone confirms a miss. */
export function normalizeMetadata(_category: MetadataCategory, slugs: string[], response: FetchedMetadataRecord) {
  const records: Record<string, TokenMetadata> = {};
  for (const slug of slugs) {
    if (!Object.prototype.hasOwnProperty.call(response, slug)) throw new Error('Incomplete metadata response');
    const raw = response[slug];
    if (raw === null) continue;
    const parsed = parseData(responseSchema, raw);
    const [address, id] = fromAssetSlug(slug);
    if (!id) throw new Error('Invalid metadata slug');
    records[slug] = parseData(TOKEN_METADATA_SCHEMA, buildTokenMetadataFromFetched(parsed, address, id));
  }
  return records;
}

/** Reserve owner ordering before transport; no foreground clock participates. */
export async function beginMetadataSync(scope: MetadataScope) {
  const request = {
    scopeKey: getMetadataScopeKey(scope),
    requestId: Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(
      ''
    )
  };
  await updateOwnedUI({ kind: 'metadata-sync-start', ...request });
  return request;
}

/** Success includes the owner's independent durable read-back, including a validated empty publication. */
export async function syncMetadata(
  request: Awaited<ReturnType<typeof beginMetadataSync>>,
  category: MetadataCategory,
  records: Record<string, TokenMetadata>,
  mode: MetadataMode = 'put'
) {
  const snapshot = await requestOwnedUISnapshot({ kind: 'metadata-sync', ...request, category, records, mode });
  if (snapshot.metadata.lastReceipt !== request.requestId) throw new CancelledError({ revert: true });
}

/** Explicit form submission saves metadata only when requested by the user. */
export const saveMetadata = (
  scope: MetadataScope,
  category: MetadataCategory,
  records: Record<string, TokenMetadata>
) => updateOwnedUI({ kind: 'metadata-save', scopeKey: getMetadataScopeKey(scope), category, records });
