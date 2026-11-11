import { z } from 'zod';

import { parseData, SAFE_KEY_SCHEMA } from 'lib/store/zustand/validation';

const loadedSchema = z.object({ slugs: z.array(z.unknown()), balances: z.record(z.unknown()) });
const BALANCE_SCHEMA = z.string().regex(/^\d+(\.\d+)?$/);

/**
 * Keep the tokens whose slug and balance validate. Anyone can send a token with an oversized id, so one invalid item is
 * skipped instead of failing the account's whole asset list; a valid slug without a balance is still a transport error.
 */
export function pickValidAssets(response: unknown) {
  const loaded = parseData(loadedSchema, response);
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
