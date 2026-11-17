import { z } from 'zod';

import { SAFE_KEY_SCHEMA } from './validation';

export const SCAMLIST_SCHEMA = z.record(SAFE_KEY_SCHEMA, z.boolean());
export const WHITELIST_SCHEMA = z.array(SAFE_KEY_SCHEMA);
const LEGACY_SECURITY_SLICES_SCHEMA = z.object({
  mainnetWhitelist: z.object({ data: z.array(z.unknown()) }),
  mainnetScamlist: z.object({ data: z.record(z.unknown()) })
});
const isSafeKey = (value: unknown): value is string => SAFE_KEY_SCHEMA.safeParse(value).success;

/** Legacy lists are fetched content: invalid entries are skipped, a corrupt slice structure still fails closed. */
export const LEGACY_SECURITY_SCHEMA = LEGACY_SECURITY_SLICES_SCHEMA.transform(source => {
  const scamlist: Record<string, boolean> = {};
  for (const [slug, value] of Object.entries(source.mainnetScamlist.data))
    if (isSafeKey(slug) && typeof value === 'boolean') scamlist[slug] = value;
  return {
    mainnetWhitelist: { data: source.mainnetWhitelist.data.filter(isSafeKey) },
    mainnetScamlist: { data: scamlist }
  };
});
