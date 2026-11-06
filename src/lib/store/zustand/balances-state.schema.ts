import { z } from 'zod';

import { SAFE_KEY_SCHEMA } from './validation';

export const BALANCE_VALUE_SCHEMA = z.string().regex(/^\d+(\.\d+)?$/);
export const BALANCE_RECORD_SCHEMA = z.record(SAFE_KEY_SCHEMA, BALANCE_VALUE_SCHEMA);
export const BALANCE_SCOPE_SCHEMA = z
  .object({
    account: SAFE_KEY_SCHEMA,
    chainId: SAFE_KEY_SCHEMA,
    networkId: SAFE_KEY_SCHEMA,
    rpcUrl: z.string().min(1).max(8192)
  })
  .strict();
export const BALANCE_SCOPE_KEY_SCHEMA = z
  .string()
  .min(1)
  .max(10000)
  .refine(key => {
    try {
      const values: unknown = JSON.parse(key);
      if (!Array.isArray(values) || values.length !== 4) return false;
      const [account, chainId, networkId, rpcUrl] = values;
      return BALANCE_SCOPE_SCHEMA.safeParse({ account, chainId, networkId, rpcUrl }).success;
    } catch {
      return false;
    }
  });
export const BALANCES_SCHEMA = z.object({
  legacy: z.record(SAFE_KEY_SCHEMA, BALANCE_RECORD_SCHEMA),
  scoped: z.record(
    BALANCE_SCOPE_KEY_SCHEMA,
    z.object({
      data: BALANCE_RECORD_SCHEMA,
      minimumRevision: z.number().int().nonnegative().optional(),
      revisions: z.record(SAFE_KEY_SCHEMA, z.number().int().nonnegative()),
      levels: z.record(SAFE_KEY_SCHEMA, z.number().int().nonnegative())
    })
  ),
  revision: z.number().int().nonnegative(),
  isBalancesAdopted: z.boolean(),
  lastReceipt: SAFE_KEY_SCHEMA.optional()
});
export type BalanceScope = z.infer<typeof BALANCE_SCOPE_SCHEMA>;
export type BalancesState = z.infer<typeof BALANCES_SCHEMA>;

/** Exact source identity; legacy account/chain records never gain invented provenance. */
export const getBalanceScopeKey = (scope: BalanceScope) =>
  JSON.stringify([scope.account, scope.chainId, scope.networkId, scope.rpcUrl]);
