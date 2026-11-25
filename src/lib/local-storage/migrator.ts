import isEqual from 'lodash/isEqual';
import { z } from 'zod';

import * as Migrator from 'lib/migrator';
import type { IMigration } from 'lib/migrator';
import { parseData } from 'lib/store/zustand/validation';

const STORAGE_KEY = 'MIGRATIONS';
const historySchema = z.array(
  z
    .object({
      name: z.string().min(1),
      dateApplied: z.string().refine(value => Number.isFinite(Date.parse(value)))
    })
    .passthrough()
);

// TypeScript 4.5's DOM declarations predate Web Locks. Keep this narrow platform contract local.
interface MigrationLocks {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

/** Serialize extension-page history read/run/write across contexts; unsupported platforms retain the source. */
export const migrate = async (migrations: IMigration[]) => {
  const locks = (navigator as Navigator & { locks?: MigrationLocks }).locks;
  if (!locks) throw new Error('Migration history coordination unavailable');
  await locks.request('temple-local-storage-migrations', async () => {
    let history = getAppliedMigrations();
    for (const migration of migrations) {
      // Singleton invocations contain the generic migrator's earlier-success/later-failure behavior.
      const applied = await Migrator.migrate(
        [migration],
        history.map(value => ({
          ...value,
          dateApplied: new Date(value.dateApplied)
        }))
      );
      if (!applied.length) continue;
      // Read again so unrelated history written while up() awaited is retained. Never replace unreadable history.
      history = getAppliedMigrations();
      for (const entry of applied) {
        if (!history.some(value => value.name === entry.name))
          history.push({ name: entry.name, dateApplied: entry.dateApplied.toISOString() });
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      if (!isEqual(getAppliedMigrations(), history)) throw new Error('Migration history verification failed');
    }
  });
};

const getAppliedMigrations = () => {
  const value = localStorage.getItem(STORAGE_KEY);
  return parseData(historySchema, value === null ? [] : JSON.parse(value));
};
