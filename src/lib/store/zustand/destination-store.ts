import { z } from 'zod';
import { persist, StorageValue } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { awaitStoresHydrated } from './await-stores-hydrated';
import { BrowserStorage } from './persist-storage';
import { createThrottledStorage } from './throttled-storage';
import { parseData, toPersistenceError } from './validation';

export interface StagedWrite {
  readonly owner: symbol;
  check(): void;
  commit(): void;
}

/** Preflight all drafts before any write. This is synchronous staging, NOT a cross-store transaction. */
export function commitStagedWrites(...writes: StagedWrite[]): void {
  if (new Set(writes.map(write => write.owner)).size !== writes.length) {
    throw new Error('Stage one draft per destination');
  }
  writes.forEach(write => write.check());
  writes.forEach(write => write.commit());
}

/** Creates an inactive vanilla migration destination with validated data and guarded public actions. */
export function createDestinationStore<D extends object, A extends object>(options: {
  name: string;
  defaults: D;
  schema: z.ZodType<D>;
  actions: (update: (recipe: (draft: D) => void) => void) => A;
  storage?: BrowserStorage;
  delay?: number;
  merge?: (stored: D, defaults: D) => D;
}) {
  const adapter = createThrottledStorage(options.name, options.delay, options.storage);
  const envelopeSchema = z.object({ version: z.literal(1), state: z.unknown() }).strict();
  let hydrationError: unknown;
  let hydrationRun: Promise<void> | undefined;
  let currentAttempt: { error?: Error } = {};
  let revision = 0;
  let isDisposed = false;
  const owner = Symbol(options.name);
  const errorListeners = new Set<(error: unknown) => void>();
  const decode = (raw: unknown): StorageValue<D> | null => {
    if (raw === undefined) return null;
    const envelope = parseData(envelopeSchema, typeof raw === 'string' ? JSON.parse(raw) : raw);
    return { version: 1, state: parseData(options.schema, envelope.state) };
  };
  const selectData = (state: unknown): D => parseData(options.schema, state);
  const assertReady = () => {
    if (isDisposed) throw new Error('Destination disposed');
    if (!store.persist.hasHydrated() || hydrationError !== undefined) {
      throw new Error('Await successful destination hydration before writing');
    }
  };
  const prepare = (recipe: (draft: D) => void): StagedWrite => {
    assertReady();
    const draft = selectData(store.getState());
    recipe(draft);
    const validated = selectData(draft);
    const expectedRevision = revision;
    let isCommitted = false;
    const check = () => {
      assertReady();
      if (isCommitted || revision !== expectedRevision) throw new Error('Stale destination draft');
    };
    return {
      owner,
      check,
      commit() {
        check();
        isCommitted = true;
        revision++;
        store.setState(current => ({ ...current, ...validated }));
      }
    };
  };
  const actions = options.actions(recipe => prepare(recipe).commit());
  const store = createStore<D & A>()(
    persist<D & A, [], [], D>(() => ({ ...selectData(options.defaults), ...actions }), {
      name: options.name,
      version: 1,
      skipHydration: true,
      partialize: selectData,
      storage: {
        getItem: async () => {
          try {
            return decode(await adapter.getItem());
          } catch (error) {
            throw toPersistenceError(error);
          }
        },
        setItem: (_name, value) => {
          // Zustand does not await persistence from setState. The adapter retains the failure;
          // persistence.flush()/getWriteError() expose it without an unhandled rejection.
          void adapter.setItem(JSON.stringify(value)).catch(() => undefined);
        },
        removeItem: () => {
          throw new Error('Destination deletion is unsupported');
        }
      },
      merge: (raw, current) => {
        if (raw === undefined) return current;
        const stored = selectData(raw);
        const data = options.merge ? options.merge(stored, selectData(options.defaults)) : stored;
        return { ...current, ...selectData(data) };
      },
      onRehydrateStorage: () => {
        const attempt = currentAttempt;
        return (_state, error) => {
          if (error !== undefined) {
            attempt.error = toPersistenceError(error);
            hydrationError = attempt.error;
            errorListeners.forEach(listener => listener(attempt.error));
          }
        };
      }
    })
  );
  const destination = {
    getState: store.getState,
    subscribe: store.subscribe,
    // Do not expose setState, setOptions, clearStorage, or unguarded rehydrate.
    persist: {
      hasHydrated: store.persist.hasHydrated,
      onFinishHydration: store.persist.onFinishHydration
    },
    hydration: {
      getError: () => hydrationError,
      onError(listener: (error: unknown) => void) {
        errorListeners.add(listener);
        return () => {
          errorListeners.delete(listener);
        };
      },
      /** Retry a failed initial read after its cause is repaired. Successful hydration is never replayed. */
      retry(): Promise<void> {
        if (hydrationRun && hydrationError === undefined) return hydrationRun;
        if (store.persist.hasHydrated()) return Promise.resolve();
        hydrationError = undefined;
        const attempt: { error?: Error } = {};
        currentAttempt = attempt;
        const run: Promise<void> = Promise.resolve()
          .then(async () => {
            await store.persist.rehydrate();
            if (attempt.error) throw attempt.error;
            await awaitStoresHydrated(destination);
          })
          .finally(() => {
            if (hydrationRun === run) hydrationRun = undefined;
          });
        hydrationRun = run;
        return run;
      }
    },
    persistence: {
      key: options.name,
      flush: () => adapter.flush(),
      readBack: async () => decode(await adapter.getItem()),
      getWriteError: adapter.getWriteError,
      dispose: async () => {
        isDisposed = true;
        try {
          await adapter.dispose();
        } catch (error) {
          isDisposed = false;
          throw error;
        }
      },
      prepare
    }
  };
  // Reads only: Zustand v5 does not persist initializer defaults on hydration.
  // Failures are latched and reported by the hydration gate; retry is explicit.
  void destination.hydration.retry().catch(() => undefined);
  return destination;
}
