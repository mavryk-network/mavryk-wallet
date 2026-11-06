import browser from 'webextension-polyfill';

import { WALLET_AUTOLOCK_TIME } from 'lib/fixed-times';

import { createAutolockEnforcer } from './autolock';
import * as PagePresence from './page-presence';

describe('createAutolockEnforcer', () => {
  const pastDeadline = () => Date.now() - WALLET_AUTOLOCK_TIME - 1;

  let lock: jest.Mock;
  let isLocked: jest.Mock;
  let hasOpenExtensionPagesSpy: jest.SpyInstance;
  let scheduleAutolockDeadlineSpy: jest.SpyInstance;

  beforeEach(async () => {
    await browser.storage.local.clear();
    lock = jest.fn().mockResolvedValue(undefined);
    isLocked = jest.fn().mockReturnValue(false);
    hasOpenExtensionPagesSpy = jest.spyOn(PagePresence, 'hasOpenExtensionPages').mockReturnValue(false);
    scheduleAutolockDeadlineSpy = jest.spyOn(PagePresence, 'scheduleAutolockDeadline').mockImplementation(() => {});
  });

  afterEach(() => {
    hasOpenExtensionPagesSpy.mockRestore();
    scheduleAutolockDeadlineSpy.mockRestore();
  });

  const getClosureTimestamp = async () =>
    (await browser.storage.local.get('last_page_closure_timestamp')).last_page_closure_timestamp;

  it('calls the injected lock and consumes the closure timestamp once the deadline has passed', async () => {
    await browser.storage.local.set({ last_page_closure_timestamp: pastDeadline() });

    await createAutolockEnforcer(lock, isLocked).enforceAutolock();

    expect(lock).toHaveBeenCalledTimes(1);
    const { last_page_closure_timestamp: timestamp } = await browser.storage.local.get('last_page_closure_timestamp');
    expect(timestamp).toBeUndefined();
  });

  it('keeps the closure timestamp when the lock fails', async () => {
    const closure = pastDeadline();
    lock.mockRejectedValue(new Error('lock failed'));
    await browser.storage.local.set({ last_page_closure_timestamp: closure });

    await expect(createAutolockEnforcer(lock, isLocked).enforceAutolock()).rejects.toThrow('lock failed');

    const { last_page_closure_timestamp: timestamp } = await browser.storage.local.get('last_page_closure_timestamp');
    expect(timestamp).toBe(closure);
  });

  it('skips the deadline while a page is open, unless the check runs for the first page opening', async () => {
    hasOpenExtensionPagesSpy.mockReturnValue(true);
    await browser.storage.local.set({ last_page_closure_timestamp: pastDeadline() });
    const { enforceAutolock, enforceAutolockOnPageOpen } = createAutolockEnforcer(lock, isLocked);

    await enforceAutolock();
    expect(lock).not.toHaveBeenCalled();

    await enforceAutolockOnPageOpen();
    expect(lock).toHaveBeenCalledTimes(1);
  });

  it('schedules the deadline for a recent closure when no page is open, e.g. after a worker restart', async () => {
    const closure = Date.now() - 1_000;
    await browser.storage.local.set({ last_page_closure_timestamp: closure });

    await createAutolockEnforcer(lock, isLocked).enforceAutolock();

    expect(lock).not.toHaveBeenCalled();
    expect(scheduleAutolockDeadlineSpy).toHaveBeenCalledWith(closure);
    expect(await getClosureTimestamp()).toBe(closure);
  });

  it('counts the deadline from now when no closure is recorded and no page is open', async () => {
    const before = Date.now();

    await createAutolockEnforcer(lock, isLocked).enforceAutolock();

    const closure = await getClosureTimestamp();
    expect(lock).not.toHaveBeenCalled();
    expect(closure).toBeGreaterThanOrEqual(before);
    expect(scheduleAutolockDeadlineSpy).toHaveBeenCalledWith(closure);
  });

  it('leaves the closure record to a page that connected while the state was read', async () => {
    hasOpenExtensionPagesSpy.mockReturnValueOnce(false).mockReturnValue(true);

    await createAutolockEnforcer(lock, isLocked).enforceAutolock();

    expect(await getClosureTimestamp()).toBeUndefined();
    expect(scheduleAutolockDeadlineSpy).not.toHaveBeenCalled();
  });

  it('consumes the closure without locking again when the wallet is already locked', async () => {
    isLocked.mockReturnValue(true);
    await browser.storage.local.set({ last_page_closure_timestamp: pastDeadline() });
    const { enforceAutolock, enforceAutolockOnPageOpen } = createAutolockEnforcer(lock, isLocked);

    await enforceAutolock();
    expect(await getClosureTimestamp()).toBeUndefined();

    await browser.storage.local.set({ last_page_closure_timestamp: pastDeadline() });
    await enforceAutolockOnPageOpen();

    expect(lock).not.toHaveBeenCalled();
    expect(await getClosureTimestamp()).toBeUndefined();
  });

  it('does not lock when lock-up is disabled', async () => {
    await browser.storage.local.set({ lock_up_enabled: false, last_page_closure_timestamp: pastDeadline() });

    await createAutolockEnforcer(lock, isLocked).enforceAutolock();

    expect(lock).not.toHaveBeenCalled();
  });
});
