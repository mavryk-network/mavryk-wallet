import { browser } from 'lib/browser';
import { ANALYTICS_USER_ID_STORAGE_KEY } from 'lib/constants';
import * as Repo from 'lib/temple/repo';

import { clearSessionWrappingKeys } from './back/vault/session-wrapping-key-store';

export async function clearAllStorages() {
  await clearAsyncStorages();
  localStorage.clear();
}

// These destinations are already live before onboarding submits. Only an explicit reset may delete them.
const OWNED_STATE_KEYS = new Set([
  'zustand-ui',
  'zustand-metadata',
  'zustand-assets',
  'zustand-balances',
  ANALYTICS_USER_ID_STORAGE_KEY
]);

/** Clear wallet storage; initial registration retains the active background owner's durable state. */
export async function clearAsyncStorages({ shouldPreserveOwnedState = false } = {}) {
  await Repo.db.delete();
  await Repo.db.open();
  if (shouldPreserveOwnedState) {
    const records = await browser.storage.local.get(null);
    // Remove only obsolete keys. Copying retained values back after clear would race owner writes
    // and expose a missing-destination interval to foreground storage-change subscribers.
    const keys = Object.keys(records).filter(key => !OWNED_STATE_KEYS.has(key));
    if (keys.length) await browser.storage.local.remove(keys);
  } else {
    await browser.storage.local.clear();
  }
  await browser.storage.session?.clear();
  await clearSessionWrappingKeys();
}

export function clearLocalStorage(exceptionsKeys?: string[]) {
  const exceptions = exceptionsKeys?.map(key => [key, localStorage.getItem(key)] as const);
  localStorage.clear();
  exceptions?.forEach(([key, val]) => {
    if (val != null) localStorage.setItem(key, val);
  });
}
