import isEqual from 'lodash/isEqual';
import { z } from 'zod';

import { awaitStoresHydrated } from './await-stores-hydrated';
import { BALANCE_RECORD_SCHEMA, BALANCES_SCHEMA } from './balances-state.schema';
import type { createBalancesStore } from './balances.store';
import { decodeLegacyUIRoot } from './legacy-ui-source';
import { OwnerFallbackKey } from './owner-fallback';
import { BrowserStorage } from './persist-storage';
import { parseData, SAFE_KEY_SCHEMA } from './validation';

const sourceSchema = z.object({
  balancesAtomic: z.record(SAFE_KEY_SCHEMA, z.object({ data: BALANCE_RECORD_SCHEMA }))
});

/** Independently adopt balance data, retaining source payloads and destination precedence on restart. */
export function createBalancesMigration(options: {
  balances: ReturnType<typeof createBalancesStore>;
  storage: BrowserStorage;
  readFallback: (key: OwnerFallbackKey) => Promise<string | null>;
}) {
  const { balances, storage, readFallback } = options;
  let isReady = false;
  const verify = async () => {
    const expected = parseData(BALANCES_SCHEMA, balances.getState());
    await balances.persistence.flush();
    if (!isEqual((await balances.persistence.readBack())?.state, expected))
      throw new Error('Balance adoption read-back failed');
  };
  return {
    isReady: () => isReady,
    async initialize() {
      if (isReady) return;
      if (balances.hydration.getError() !== undefined) await balances.hydration.retry();
      await awaitStoresHydrated(balances);
      await balances.persistence.flush();
      if (!balances.getState().isBalancesAdopted) {
        let source: z.infer<typeof sourceSchema> | undefined;
        for (const key of ['persist:temple-root-task11', 'persist:temple-root'] as const) {
          const result = await storage.get(key);
          const raw = result[key] === undefined ? await readFallback(key) : result[key];
          if (raw === null && result[key] === undefined) continue;
          const root = decodeLegacyUIRoot(raw);
          if (root.balances !== undefined) {
            source = parseData(sourceSchema, root.balances);
            break;
          }
        }
        balances.persistence
          .prepare(draft => {
            for (const [key, entity] of Object.entries(source?.balancesAtomic ?? {})) {
              draft.legacy[key] = { ...entity.data, ...draft.legacy[key] };
            }
          })
          .commit();
        await verify();
        balances.persistence
          .prepare(draft => {
            draft.isBalancesAdopted = true;
          })
          .commit();
      }
      await verify();
      isReady = true;
    }
  };
}
