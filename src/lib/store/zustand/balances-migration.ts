import isEqual from 'lodash/isEqual';
import { z } from 'zod';

import { awaitStoresHydrated } from './await-stores-hydrated';
import { BALANCE_VALUE_SCHEMA, BALANCES_SCHEMA } from './balances-state.schema';
import type { createBalancesStore } from './balances.store';
import { decodeLegacyUIRoot } from './legacy-ui-source';
import { OwnerFallbackKey } from './owner-fallback';
import { BrowserStorage } from './persist-storage';
import { parseData, pickValidRecords, reportDroppedLegacyRecords, SAFE_KEY_SCHEMA } from './validation';

const sourceSchema = z.object({ balancesAtomic: z.unknown() });
type LegacyBalances = Record<string, Record<string, string>>;

/** Keep valid account/chain balances; one oversized slug (an airdropped token) must not block adoption. */
function parseLegacyBalances(raw: unknown): LegacyBalances {
  let dropped = 0;
  const onDrop = () => void dropped++;
  const entities = pickValidRecords(
    SAFE_KEY_SCHEMA,
    z.object({ data: z.unknown() }),
    parseData(sourceSchema, raw).balancesAtomic,
    onDrop
  );
  const balances = Object.fromEntries(
    Object.entries(entities).map(([key, entity]) => [
      key,
      pickValidRecords(SAFE_KEY_SCHEMA, BALANCE_VALUE_SCHEMA, entity.data, onDrop)
    ])
  );
  reportDroppedLegacyRecords('balance', dropped);
  return balances;
}

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
        let source: LegacyBalances | undefined;
        for (const key of ['persist:temple-root-task11', 'persist:temple-root'] as const) {
          const result = await storage.get(key);
          const raw = result[key] === undefined ? await readFallback(key) : result[key];
          if (raw === null && result[key] === undefined) continue;
          const root = decodeLegacyUIRoot(raw);
          if (root.balances !== undefined) {
            source = parseLegacyBalances(root.balances);
            break;
          }
        }
        balances.persistence
          .prepare(draft => {
            for (const [key, data] of Object.entries(source ?? {})) {
              draft.legacy[key] = { ...data, ...draft.legacy[key] };
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
