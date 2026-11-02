import { UNLOCK_INTERRUPTED_BY_LOCK_ERROR } from 'lib/constants';
import { BACKGROUND_IS_WORKER } from 'lib/env';
import { TempleStatus } from 'lib/temple/types';
import { getAuthTokensFromStorage, isJwtExpiringSoon } from 'mavryk/api';

import { createAutolockEnforcer } from './autolock';
import { JWT_EXPIRING_SOON_THRESHOLD_MS } from './constants';
import { store } from './store';
import { Vault } from './vault';

/**
 * Serialises wallet locks with unlock flows. The lock itself is passed in to avoid importing actions.ts.
 * `waitForLocks` resolves once every lock in flight has finished, with a check reporting whether a lock started since.
 */
export function createLockCoordinator(lockWallet: () => Promise<void>) {
  /** Bumped when a lock starts and again when it ends; an unlock flow that saw a different value must not finish */
  let lockEpoch = 0;
  /** Settles once every lock in flight has finished, so an unlock started during a lock runs after it */
  let pendingLock: Promise<unknown> | undefined;
  /**
   * Set when a lock finishes and cleared when an unlock flow starts. The store alone cannot tell the wallet is locked:
   * it also reads Locked while a password unlock or a session recovery is still in flight, which must be locked.
   */
  let hasLockedSinceUnlockStarted = false;

  const runLock = async () => {
    lockEpoch++;
    try {
      await lockWallet();
      hasLockedSinceUnlockStarted = true;
    } finally {
      lockEpoch++;
    }
  };

  const lock = () => {
    const run = runLock();
    const settled: Promise<unknown> = Promise.allSettled([pendingLock, run]).then(() => {
      if (pendingLock === settled) pendingLock = undefined;
    });
    pendingLock = settled;

    return run;
  };

  const waitForLocks = async () => {
    while (pendingLock) await pendingLock;
    hasLockedSinceUnlockStarted = false;
    const epoch = lockEpoch;

    return () => epoch !== lockEpoch;
  };

  /** Runs a password unlock's vault setup after every lock in flight, and rejects it if a lock lands meanwhile */
  const unlockAfterLocks = async <T>(setupVault: () => Promise<T>) => {
    const isInterruptedByLock = await waitForLocks();
    const unlockedState = await setupVault();
    if (isInterruptedByLock()) {
      // Vault.setup may have saved the session pass hash after the lock forgot it
      if (BACKGROUND_IS_WORKER) await Vault.forgetSession();
      throw new Error(UNLOCK_INTERRUPTED_BY_LOCK_ERROR);
    }

    return unlockedState;
  };

  const isLocked = () => hasLockedSinceUnlockStarted && store.getState().status !== TempleStatus.Ready;

  return { lock, waitForLocks, unlockAfterLocks, ...createAutolockEnforcer(lock, isLocked) };
}

export const shouldLockOnSessionRecovery = async () => {
  const { accessToken } = await getAuthTokensFromStorage();
  if (!accessToken) return true;

  return isJwtExpiringSoon(accessToken, JWT_EXPIRING_SOON_THRESHOLD_MS);
};
