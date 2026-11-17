import { z } from 'zod';

import { FetchedMetadataRecord } from 'lib/metadata/fetch';
import { MetadataCategory } from 'lib/metadata/metadata-scope';
import { normalizeMetadata } from 'lib/metadata/sync-metadata';
import { parseData, SAFE_KEY_SCHEMA } from 'lib/store/zustand/validation';

const loadedSchema = z.object({ slugs: z.array(z.unknown()), balances: z.record(z.unknown()) });
const BALANCE_SCHEMA = z.string().regex(/^\d+(\.\d+)?$/);

/**
 * Keep the tokens whose slug and balance validate. Anyone can send a token with an oversized id, so one invalid item is
 * skipped instead of failing the account's whole asset list; a valid slug without a balance is still a transport error.
 * Only `slugs` and `balances` are read: other response fields (raw third-party metadata) are validated by their own
 * owners and must never fail this check.
 */
export function pickValidAssets(response: { slugs: unknown; balances: unknown }) {
  const loaded = parseData(loadedSchema, { slugs: response.slugs, balances: response.balances });
  const balances: Record<string, string> = {};
  for (const [slug, balance] of Object.entries(loaded.balances)) {
    const parsed = BALANCE_SCHEMA.safeParse(balance);
    if (SAFE_KEY_SCHEMA.safeParse(slug).success && parsed.success) balances[slug] = parsed.data;
  }
  const slugs: string[] = [];
  for (const slug of loaded.slugs) {
    if (typeof slug !== 'string' || !SAFE_KEY_SCHEMA.safeParse(slug).success) continue;
    if (!Object.prototype.hasOwnProperty.call(balances, slug)) {
      // An invalid balance for a valid slug is skipped with it; a missing balance is incomplete transport.
      if (Object.prototype.hasOwnProperty.call(loaded.balances, slug)) continue;
      throw new Error('Incomplete asset balances');
    }
    slugs.push(slug);
  }
  return { slugs, balances };
}

/**
 * Validate one account-asset response for publication. Tokens and balances are checked per item; new-token metadata is
 * checked per record by normalizeMetadata, which keeps only known string fields, so one token's malformed or unsafe
 * metadata skips only that record and never its token, its balance or the rest of the account.
 *
 * @param category the asset category the response was loaded for
 * @param response the loader response
 * @returns the valid slugs, balances and normalized new metadata
 */
export function pickAccountAssetsSync(
  category: MetadataCategory,
  response: { slugs: unknown; balances: unknown; newMeta: FetchedMetadataRecord }
) {
  const { slugs, balances } = pickValidAssets({ slugs: response.slugs, balances: response.balances });
  const metadata = normalizeMetadata(category, Object.keys(response.newMeta), response.newMeta);
  return { slugs, balances, metadata };
}
