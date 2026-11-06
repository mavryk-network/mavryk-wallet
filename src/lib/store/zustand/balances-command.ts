import { z } from 'zod';

import {
  BALANCE_RECORD_SCHEMA,
  BALANCE_SCOPE_SCHEMA,
  BalancesState,
  getBalanceScopeKey
} from './balances-state.schema';
import { SAFE_KEY_SCHEMA } from './validation';

export const BALANCES_COMMAND_SCHEMA = z.union([
  z.object({ kind: z.literal('balances-start'), requestId: SAFE_KEY_SCHEMA, scope: BALANCE_SCOPE_SCHEMA }).strict(),
  z.object({ kind: z.literal('balances-cancel'), requestId: SAFE_KEY_SCHEMA }).strict(),
  z
    .object({
      kind: z.literal('balances-sync'),
      requestId: SAFE_KEY_SCHEMA,
      scope: BALANCE_SCOPE_SCHEMA,
      records: BALANCE_RECORD_SCHEMA
    })
    .strict(),
  z
    .object({
      kind: z.literal('balances-delta'),
      requestId: SAFE_KEY_SCHEMA,
      scope: BALANCE_SCOPE_SCHEMA,
      records: BALANCE_RECORD_SCHEMA,
      level: z.number().int().nonnegative(),
      category: z.enum(['native', 'tokens']),
      isReorg: z.boolean()
    })
    .strict()
]);

/** Owner revisions protect per-slug writes; endpoint omission never erases a cached balance. */
export function applyBalanceRecords(
  draft: BalancesState,
  scopeKey: string,
  records: Record<string, string>,
  revision: number,
  delta?: { category: 'native' | 'tokens'; level: number; isReorg: boolean }
) {
  const bucket = draft.scoped[scopeKey] ?? { data: {}, revisions: {}, levels: {} };
  if (revision < (bucket.minimumRevision ?? 0)) return;
  if (delta) {
    const previous = bucket.levels[delta.category];
    if (!delta.isReorg && previous !== undefined && delta.level < previous) return;
    bucket.levels[delta.category] = delta.level;
    if (delta.isReorg) {
      bucket.minimumRevision = revision;
      // Invalidate every older snapshot, while retaining visible balances during recovery.
      for (const slug of Object.keys(bucket.data)) bucket.revisions[slug] = revision;
    }
  }
  for (const [slug, value] of Object.entries(records)) {
    if ((bucket.revisions[slug] ?? 0) > revision) continue;
    bucket.data[slug] = value;
    bucket.revisions[slug] = revision;
  }
  draft.scoped[scopeKey] = bucket;
}

export { getBalanceScopeKey };
