import browser from 'webextension-polyfill';

import { LAST_PAGE_CLOSURE_STORAGE_KEY, LOCK_UP_ENABLED_STORAGE_KEY } from 'lib/constants';
import { WALLET_AUTOLOCK_TIME } from 'lib/fixed-times';

import { hasOpenExtensionPages, scheduleAutolockDeadline } from './page-presence';

const readAutolockState = async () => {
  const { [LOCK_UP_ENABLED_STORAGE_KEY]: isLockUpEnabled, [LAST_PAGE_CLOSURE_STORAGE_KEY]: closureTimestamp } =
    await browser.storage.local.get([LOCK_UP_ENABLED_STORAGE_KEY, LAST_PAGE_CLOSURE_STORAGE_KEY]);

  return {
    isLockUpEnabled: isLockUpEnabled !== false,
    closureTimestamp: typeof closureTimestamp === 'number' ? closureTimestamp : undefined
  };
};

/**
 * Builds the autolock deadline checks around the wallet lock, which is passed in to avoid importing actions.ts.
 * `isLocked` reports a wallet already locked, so the deadline does not repeat the lock and its auth logout.
 */
export function createAutolockEnforcer(lock: () => Promise<unknown>, isLocked: () => boolean) {
  const lockAndConsumeClosure = async () => {
    if (!isLocked()) await lock();
    await browser.storage.local.remove(LAST_PAGE_CLOSURE_STORAGE_KEY);
  };

  /** The deadline check without the open-page gate, run when the first page opens, before its closure is cleared */
  const enforceAutolockOnPageOpen = async () => {
    const { isLockUpEnabled, closureTimestamp } = await readAutolockState();
    if (!isLockUpEnabled || closureTimestamp === undefined) return;
    if (Date.now() - closureTimestamp < WALLET_AUTOLOCK_TIME) return;

    await lockAndConsumeClosure();
  };

  /**
   * Locks once WALLET_AUTOLOCK_TIME has passed since the last extension page closed (recorded by page-presence).
   * With no page open and the deadline still ahead (e.g. a restarted worker), it schedules the check for the deadline;
   * with no closure recorded (e.g. a session restored before any page connected), it counts from now.
   */
  const enforceAutolock = async () => {
    if (hasOpenExtensionPages()) return;

    const { isLockUpEnabled, closureTimestamp } = await readAutolockState();
    // A page may have connected while the state was read; its own check then owns the closure record
    if (!isLockUpEnabled || hasOpenExtensionPages()) return;

    if (closureTimestamp === undefined) {
      const now = Date.now();
      await browser.storage.local.set({ [LAST_PAGE_CLOSURE_STORAGE_KEY]: now });
      scheduleAutolockDeadline(now);
    } else if (Date.now() - closureTimestamp < WALLET_AUTOLOCK_TIME) {
      scheduleAutolockDeadline(closureTimestamp);
    } else {
      await lockAndConsumeClosure();
    }
  };

  return { enforceAutolock, enforceAutolockOnPageOpen };
}
