import { awaitStoresHydrated, HydratableStore } from '../await-stores-hydrated';
import { deferred, memoryStorage, microtasks } from '../test-support/helpers';
import { createUIStore } from '../ui.store';

function fakeStore(isInitiallyHydrated = false) {
  let isHydrated = isInitiallyHydrated;
  let error: unknown;
  const finishListeners = new Set<() => void>();
  const errorListeners = new Set<(error: unknown) => void>();
  const store: HydratableStore = {
    persist: {
      hasHydrated: () => isHydrated,
      onFinishHydration: listener => {
        finishListeners.add(listener);
        return () => {
          finishListeners.delete(listener);
        };
      }
    },
    hydration: {
      getError: () => error,
      onError: listener => {
        errorListeners.add(listener);
        return () => {
          errorListeners.delete(listener);
        };
      }
    }
  };
  return {
    store,
    finishListeners,
    errorListeners,
    finish() {
      isHydrated = true;
      finishListeners.forEach(listener => listener());
    },
    fail() {
      error = new Error('read failed');
      errorListeners.forEach(listener => listener(error));
    }
  };
}

describe('hydration gate', () => {
  it('handles zero stores and already hydrated stores without subscriptions', async () => {
    const ready = fakeStore(true);
    await awaitStoresHydrated();
    await awaitStoresHydrated(ready.store);
    expect(ready.finishListeners.size).toBe(0);
  });

  it('waits for multiple stores and concurrent callers, cleaning every listener', async () => {
    const first = fakeStore();
    const second = fakeStore();
    let isDone = false;
    const a = awaitStoresHydrated(first.store, second.store).then(() => {
      isDone = true;
    });
    const b = awaitStoresHydrated(second.store);
    first.finish();
    await microtasks();
    expect(isDone).toBe(false);
    second.finish();
    await Promise.all([a, b]);
    for (const item of [first, second]) {
      expect(item.finishListeners.size).toBe(0);
      expect(item.errorListeners.size).toBe(0);
    }
  });

  it('closes check/subscribe race, including synchronous subscription callbacks', async () => {
    const item = fakeStore();
    const subscribe = item.store.persist.onFinishHydration;
    item.store.persist.onFinishHydration = listener => {
      item.finish();
      return subscribe(listener);
    };
    await awaitStoresHydrated(item.store);
    expect(item.finishListeners.size).toBe(0);
    const synchronous = fakeStore();
    synchronous.store.persist.onFinishHydration = listener => {
      const cleanup = subscribe(listener);
      synchronous.finish();
      listener();
      return cleanup;
    };
    await awaitStoresHydrated(synchronous.store);
    expect(item.finishListeners.size).toBe(0);
  });

  it('rejects and cleans listeners on every requested store after a failure', async () => {
    const a = fakeStore();
    const b = fakeStore();
    const result = awaitStoresHydrated(a.store, b.store);
    b.fail();
    await expect(result).rejects.toThrow('read failed');
    for (const item of [a, b]) {
      expect(item.finishListeners.size).toBe(0);
      expect(item.errorListeners.size).toBe(0);
    }
    await expect(awaitStoresHydrated(b.store)).rejects.toThrow('read failed');
  });
});

describe('real asynchronous persisted-store hydration', () => {
  it('replaces defaults before resolving and preserves actions without startup writes', async () => {
    const { storage } = memoryStorage();
    const read = deferred<Record<string, unknown>>();
    const originalGet = storage.get;
    storage.get = jest.fn(() => read.promise);
    const store = createUIStore(storage);
    expect(() => store.getState().setIsNewsEnabled(false)).toThrow('hydration');
    const complete = awaitStoresHydrated(store);
    const state = { ...store.getState(), userId: 'adopted-id', isNewsEnabled: false };
    read.resolve({ 'zustand-ui': JSON.stringify({ version: 1, state }) });
    await complete;
    expect(store.getState().userId).toBe('adopted-id');
    expect(store.getState().isNewsEnabled).toBe(false);
    expect(typeof store.getState().setIsNewsEnabled).toBe('function');
    expect(storage.set).not.toHaveBeenCalled();
    storage.get = originalGet;
    store.getState().setIsNewsEnabled(true);
    await store.persistence.flush();
    expect((await store.persistence.readBack())?.state.isNewsEnabled).toBe(true);
  });

  it('latches read failures, rejects gates, and permits an explicit deduplicated retry', async () => {
    const { storage } = memoryStorage();
    const read = deferred<Record<string, unknown>>();
    storage.get = jest.fn(() => read.promise);
    const store = createUIStore(storage);
    const gate = awaitStoresHydrated(store);
    read.reject(new Error('storage denied'));
    await expect(gate).rejects.toThrow('storage denied');
    expect(store.persist.hasHydrated()).toBe(false);
    expect(() => store.getState().setUserId('new-id')).toThrow('hydration');
    expect(storage.set).not.toHaveBeenCalled();
    storage.get = jest.fn(async () => ({}));
    const retry = store.hydration.retry();
    expect(store.hydration.retry()).toBe(retry);
    await Promise.all([retry, awaitStoresHydrated(store)]);
    expect(storage.get).toHaveBeenCalledTimes(1);
    expect(store.hydration.getError()).toBeUndefined();
    await store.hydration.retry();
    expect(storage.get).toHaveBeenCalledTimes(1);
  });

  it('normalizes undefined read rejections and permits retry immediately after gate rejection', async () => {
    const { storage } = memoryStorage();
    storage.get = jest.fn(() => Promise.reject(undefined));
    const store = createUIStore(storage);
    const gate = awaitStoresHydrated(store);
    await expect(gate).rejects.toThrow('Persistence operation failed');
    storage.get = jest.fn(async () => ({}));
    await Promise.all([store.hydration.retry(), awaitStoresHydrated(store)]);
    expect(store.persist.hasHydrated()).toBe(true);
  });

  it.each([
    '{',
    'null',
    '[]',
    '{"state":[],"version":1}',
    '{"state":{},"version":2}',
    '{"state":{},"version":1}',
    '{"state":{},"version":1,"__proto__":{"polluted":true}}',
    '{"state":{"constructor":{"prototype":{"polluted":true}}},"version":1}',
    '{"state":{"promotionHidingTimestamps":{"prototype":1}},"version":1}'
  ])('rejects malformed/unsafe serialized envelope %s without writing defaults', async raw => {
    const { storage, records } = memoryStorage({ 'zustand-ui': raw });
    const store = createUIStore(storage);
    await expect(awaitStoresHydrated(store)).rejects.toBeDefined();
    expect(store.persist.hasHydrated()).toBe(false);
    expect(store.getState().userId).toBeNull();
    expect(storage.set).not.toHaveBeenCalled();
    expect(records['zustand-ui']).toBe(raw);
    expect(Object.prototype).not.toHaveProperty('polluted');
    await microtasks();
    delete records['zustand-ui']; // Test repairs corrupt destination, never a runtime deletion.
    await store.hydration.retry();
    expect(store.persist.hasHydrated()).toBe(true);
  });

  it('rejects non-plain objects and nested pollution in otherwise valid envelopes', async () => {
    const initial = createUIStore(memoryStorage().storage);
    await awaitStoresHydrated(initial);
    for (const field of ['__proto__', 'constructor', 'prototype']) {
      const state = JSON.parse(JSON.stringify(initial.getState()));
      state.promotionHidingTimestamps = JSON.parse(`{"${field}":123}`);
      const { storage } = memoryStorage({ 'zustand-ui': { version: 1, state } });
      const store = createUIStore(storage);
      await expect(awaitStoresHydrated(store)).rejects.toThrow('Unsafe');
    }
    const { storage } = memoryStorage({ 'zustand-ui': Object.create({ version: 1 }) });
    await expect(awaitStoresHydrated(createUIStore(storage))).rejects.toThrow('prototype');
  });
});
