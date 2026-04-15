import type { StorageValue } from 'zustand/middleware';

import { browserStorage } from './persist-storage';

const THROTTLE_MS = 1000;

/**
 * Creates a Zustand persist storage adapter with throttled writes to browser.storage.local.
 * Reads are immediate; writes are coalesced into one per 1s window (trailing-edge).
 *
 * Trade-off: In MV3 service workers, pending writes can be lost if the worker is killed
 * before the timer fires. These stores are used in UI contexts (popup/fullpage) where
 * this risk is acceptable. Do not use this adapter in background-only stores.
 */
export function createThrottledPersistStorage<S>() {
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const pendingWrites = new Map<string, string>();

  const flushPendingWrites = async () => {
    for (const [name, serialized] of pendingWrites) {
      await browserStorage.setItem(name, serialized);
    }
    pendingWrites.clear();
  };

  // Flush any pending throttled writes before the popup closes to prevent write-loss
  window.addEventListener('beforeunload', () => {
    void flushPendingWrites();
  });

  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      const raw = await browserStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<S>) : null;
    },

    setItem: async (name: string, value: StorageValue<S>): Promise<void> => {
      const existing = pending.get(name);
      if (existing) clearTimeout(existing);
      const serialized = JSON.stringify(value);
      pendingWrites.set(name, serialized);
      const timer = setTimeout(async () => {
        pending.delete(name);
        pendingWrites.delete(name);
        await browserStorage.setItem(name, serialized);
      }, THROTTLE_MS);
      pending.set(name, timer);
    },

    removeItem: async (name: string): Promise<void> => {
      const existing = pending.get(name);
      if (existing) {
        clearTimeout(existing);
        pending.delete(name);
        pendingWrites.delete(name);
      }
      await browserStorage.removeItem(name);
    }
  };
}
