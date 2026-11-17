import { CancelledError } from '@tanstack/react-query';
import { z } from 'zod';

import { fromAssetSlug } from 'lib/assets/utils';
import { TOKEN_METADATA_SCHEMA } from 'lib/store/zustand/metadata-state.schema';
import { requestOwnedUISnapshot, updateOwnedUI } from 'lib/store/zustand/ui-client';
import { SAFE_KEY_SCHEMA } from 'lib/store/zustand/validation';

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

/**
 * Normalize a metadata batch. A slug missing from the response is a transport failure and fails the batch; a record
 * that is malformed or oversized (third-party token metadata) is skipped like a miss, so one airdropped token cannot
 * block metadata for every other token in its batch. Null alone confirms a miss.
 */
export function normalizeMetadata(_category: MetadataCategory, slugs: string[], response: FetchedMetadataRecord) {
  const records: Record<string, TokenMetadata> = {};
  for (const slug of slugs) {
    if (!Object.prototype.hasOwnProperty.call(response, slug)) throw new Error('Incomplete metadata response');
    const raw = response[slug];
    if (raw === null) continue;
    const parsed = responseSchema.safeParse(raw);
    const [address, id] = fromAssetSlug(slug);
    if (!parsed.success || !id || !SAFE_KEY_SCHEMA.safeParse(slug).success) continue;
    const metadata = TOKEN_METADATA_SCHEMA.safeParse(buildTokenMetadataFromFetched(parsed.data, address, id));
    if (metadata.success) records[slug] = metadata.data;
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
