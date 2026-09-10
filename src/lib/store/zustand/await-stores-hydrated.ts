export interface HydratableStore {
  persist: {
    hasHydrated(): boolean;
    onFinishHydration(listener: () => void): () => void;
  };
  hydration: {
    getError(): unknown;
    onError(listener: (error: unknown) => void): () => void;
  };
}

/** Await successful hydration of every destination, unsubscribing all listeners on success or failure. */
export function awaitStoresHydrated(...stores: HydratableStore[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanups: (() => void)[] = [];
    let isSettled = false;
    const settle = (error?: unknown) => {
      if (isSettled) return;
      isSettled = true;
      cleanups.forEach(cleanup => cleanup());
      if (error !== undefined) reject(error);
      else resolve();
    };
    const check = () => {
      for (const store of stores) {
        const error = store.hydration.getError();
        if (error !== undefined) return settle(error);
      }
      if (stores.every(store => store.persist.hasHydrated())) settle();
    };
    const subscribe = (create: () => () => void) => {
      const cleanup = create();
      // A synchronous callback may settle while a subscription is being created.
      if (isSettled) cleanup();
      else cleanups.push(cleanup);
    };
    check();
    for (const store of stores) {
      if (isSettled) break;
      subscribe(() => store.persist.onFinishHydration(check));
      if (!isSettled) subscribe(() => store.hydration.onError(settle));
    }
    check(); // Close the initial check/subscribe race.
  });
}
