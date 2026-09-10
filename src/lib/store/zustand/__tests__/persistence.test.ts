import { deferred, memoryStorage, microtasks } from '../test-support/helpers';
import { createThrottledStorage } from '../throttled-storage';

describe('ordered durable storage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('bypasses the throttle but waits for the actual browser write and reads durable values', async () => {
    const { storage, records } = memoryStorage();
    const write = deferred<void>();
    storage.set = jest.fn(async items => {
      await write.promise;
      Object.assign(records, items);
    });
    const adapter = createThrottledStorage('destination', 1000, storage);
    let isSetDone = false;
    let isFlushDone = false;
    const completion = adapter.setItem('snapshot').then(() => {
      isSetDone = true;
    });
    expect(storage.set).not.toHaveBeenCalled();
    const flush = adapter.flush().then(() => {
      isFlushDone = true;
    });
    await microtasks();
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(isSetDone).toBe(false);
    expect(isFlushDone).toBe(false);
    expect(await adapter.getItem()).toBeUndefined();
    write.resolve();
    await Promise.all([completion, flush]);
    expect(await adapter.getItem()).toBe('snapshot');
    jest.runOnlyPendingTimers();
    expect(storage.set).toHaveBeenCalledTimes(1);
    await adapter.dispose();
    expect(jest.getTimerCount()).toBe(0);
    await expect(adapter.setItem('after disposal')).rejects.toThrow('disposed');
  });

  it('coalesces queued snapshots and completes every covered setItem', async () => {
    const { storage } = memoryStorage();
    const adapter = createThrottledStorage('destination', 1000, storage);
    const a = adapter.setItem('old');
    const b = adapter.setItem('new');
    jest.advanceTimersByTime(999);
    expect(storage.set).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await Promise.all([a, b]);
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(await adapter.getItem()).toBe('new');
    await adapter.dispose();
  });

  it('orders in-flight writes, overlapping flushes, and newer snapshots without stale timer replay', async () => {
    const { storage, records } = memoryStorage();
    const oldWrite = deferred<void>();
    const newWrite = deferred<void>();
    const values: unknown[] = [];
    storage.set = jest.fn(async items => {
      values.push(items.destination);
      await (items.destination === 'old' ? oldWrite.promise : newWrite.promise);
      Object.assign(records, items);
    });
    const adapter = createThrottledStorage('destination', 1000, storage);
    const oldSet = adapter.setItem('old');
    jest.advanceTimersByTime(1000);
    await microtasks();
    let isFirstDone = false;
    const firstFlush = adapter.flush().then(() => {
      isFirstDone = true;
    });
    const newerSet = adapter.setItem('new');
    let isSecondDone = false;
    const secondFlush = adapter.flush().then(() => {
      isSecondDone = true;
    });
    expect(values).toEqual(['old']);
    oldWrite.resolve();
    await oldSet;
    await microtasks();
    expect(values).toEqual(['old', 'new']);
    expect(isFirstDone).toBe(true);
    expect(isSecondDone).toBe(false);
    newWrite.resolve();
    await Promise.all([firstFlush, secondFlush, newerSet]);
    jest.runOnlyPendingTimers();
    expect(await adapter.getItem()).toBe('new');
    expect(storage.set).toHaveBeenCalledTimes(2);
    await adapter.dispose();
  });

  it('rejects failed flushes, retains snapshots, and retries explicitly', async () => {
    const { storage } = memoryStorage();
    const originalSet = storage.set;
    storage.set = jest.fn(async () => {
      throw new Error('quota');
    });
    const adapter = createThrottledStorage('destination', 1000, storage);
    const setResult = expect(adapter.setItem('retained')).rejects.toThrow('quota');
    const first = adapter.flush();
    const overlap = adapter.flush();
    await Promise.all([expect(first).rejects.toThrow('quota'), expect(overlap).rejects.toThrow('quota'), setResult]);
    expect(adapter.getWriteError()).toEqual(new Error('quota'));
    expect(await adapter.getItem()).toBeUndefined();
    jest.runOnlyPendingTimers();
    expect(storage.set).toHaveBeenCalledTimes(1);
    storage.set = originalSet;
    await adapter.flush();
    expect(await adapter.getItem()).toBe('retained');
    expect(adapter.getWriteError()).toBeUndefined();
    await adapter.dispose();
  });

  it('retains the newer snapshot when an older in-flight write fails', async () => {
    const { storage } = memoryStorage();
    const originalSet = storage.set;
    const write = deferred<void>();
    storage.set = jest.fn(() => write.promise);
    const adapter = createThrottledStorage('destination', 0, storage);
    const oldSet = expect(adapter.setItem('old')).rejects.toThrow('offline');
    await microtasks();
    const newerSet = expect(adapter.setItem('new')).rejects.toThrow('offline');
    const flush = expect(adapter.flush()).rejects.toThrow('offline');
    write.reject(new Error('offline'));
    await Promise.all([oldSet, newerSet, flush]);
    storage.set = originalSet;
    await adapter.flush();
    expect(await adapter.getItem()).toBe('new');
    await adapter.dispose();
  });

  it('exposes timer write failure without automatic retry or discarded data', async () => {
    const { storage } = memoryStorage();
    const originalSet = storage.set;
    storage.set = jest.fn(async () => {
      throw new Error('denied');
    });
    const adapter = createThrottledStorage('destination', 1000, storage);
    const failure = expect(adapter.setItem('first')).rejects.toThrow('denied');
    jest.advanceTimersByTime(1000);
    await failure;
    const newer = adapter.setItem('second');
    jest.advanceTimersByTime(5000);
    expect(storage.set).toHaveBeenCalledTimes(1);
    storage.set = originalSet;
    await adapter.flush();
    await newer;
    expect(await adapter.getItem()).toBe('second');
    await adapter.dispose();
  });
});
