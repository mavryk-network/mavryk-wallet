import { BROWSER_STORAGE, BrowserStorage } from './persist-storage';
import { toPersistenceError } from './validation';

interface Snapshot {
  sequence: number;
  serialized: string;
}

/**
 * One ordered writer per destination key. setItem and flush resolve only after the actual write.
 * Coalescing covers older snapshots; failed snapshots remain queued until explicit flush retry.
 */
export function createThrottledStorage(key: string, delay = 1000, storage: BrowserStorage = BROWSER_STORAGE) {
  let sequence = 0;
  let durableSequence = 0;
  let pending: Snapshot | undefined;
  let running: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writeError: unknown;
  let isDisposed = false;
  const waiters = new Set<{ sequence: number; resolve: () => void; reject: (error: unknown) => void }>();

  const cancelTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const drain = (): Promise<void> => {
    cancelTimer();
    if (running) return running;
    writeError = undefined;
    // Defer work until running is assigned, even for a synchronously throwing storage implementation.
    running = Promise.resolve().then(async () => {
      try {
        while (pending) {
          const snapshot = pending;
          pending = undefined;
          try {
            await storage.set({ [key]: snapshot.serialized });
          } catch (error) {
            if (!pending) pending = snapshot;
            throw toPersistenceError(error);
          }
          durableSequence = snapshot.sequence;
          for (const waiter of waiters) {
            if (waiter.sequence <= durableSequence) {
              waiters.delete(waiter);
              waiter.resolve();
            }
          }
        }
      } catch (error) {
        writeError = error;
        for (const waiter of waiters) waiter.reject(error);
        waiters.clear();
        throw error;
      } finally {
        running = undefined;
      }
    });
    return running;
  };

  return {
    /** Reads durable browser storage directly, never the pending memory snapshot. */
    async getItem(): Promise<unknown> {
      const records = await storage.get(key);
      return Object.prototype.hasOwnProperty.call(records, key) ? records[key] : undefined;
    },
    setItem(serialized: string): Promise<void> {
      if (isDisposed) return Promise.reject(new Error('Persistence adapter disposed'));
      pending = { sequence: ++sequence, serialized };
      const completion = new Promise<void>((resolve, reject) => waiters.add({ sequence, resolve, reject }));
      cancelTimer();
      if (!running && writeError === undefined) {
        if (delay === 0) {
          // Errors remain observable via completion, getWriteError, and explicit flush retry.
          void drain().catch(() => undefined);
        } else {
          timer = setTimeout(() => void drain().catch(() => undefined), delay);
        }
      }
      return completion;
    },
    /** Drains all snapshots accepted before this call; concurrent callers share the ordered writer. */
    async flush(): Promise<void> {
      const target = sequence;
      if (durableSequence >= target) return;
      const completion = new Promise<void>((resolve, reject) => waiters.add({ sequence: target, resolve, reject }));
      void drain().catch(() => undefined);
      await completion;
    },
    getWriteError: () => writeError,
    /** Call only when the destination is no longer used. Failure leaves it retryable. */
    async dispose(): Promise<void> {
      isDisposed = true;
      try {
        await this.flush();
        cancelTimer();
      } catch (error) {
        isDisposed = false;
        throw error;
      }
    }
  };
}
