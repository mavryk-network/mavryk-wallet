/*
  Import as early as possible in extension pages.
  (!) Contains side-effects.
*/

import browser from 'webextension-polyfill';

import { LAST_PAGE_CLOSURE_STORAGE_KEY, LOCK_UP_ENABLED_STORAGE_KEY } from 'lib/constants';
import { WALLET_AUTOLOCK_TIME } from 'lib/fixed-times';
import { request, assertResponse } from 'lib/temple/front';
import { TempleMessageType } from 'lib/temple/types';

import { getIsLockUpEnabled } from './index';

if (window.location.href.includes('extension://') === false)
  throw new Error('Lock-up checks are meant for extension pages only.');

const CLOSURE_STORAGE_KEY = 'last-page-closure-timestamp';

const isSinglePageOpened = () => getOpenedTemplePagesN() === 1;

// Locking if this page was first to open & lock time passed

if (getIsLockUpEnabled() && isSinglePageOpened()) {
  const closureTimestamp = Number(localStorage.getItem(CLOSURE_STORAGE_KEY));
  if (closureTimestamp && Date.now() - closureTimestamp >= WALLET_AUTOLOCK_TIME) lock();
}

// Mirroring the lock-up state for the background, which enforces the deadline. The background clears its closure
// record itself once it has checked it (page-presence), so this page must not remove it first.

browser.storage.local.set({ [LOCK_UP_ENABLED_STORAGE_KEY]: getIsLockUpEnabled() }).catch(err => console.error(err));

// Saving last time, when all pages are closed. The background records it too (page-presence); this is a backup

window.addEventListener(
  'pagehide',
  () => {
    if (!isSinglePageOpened()) return;

    const closureTimestamp = Date.now();
    localStorage.setItem(CLOSURE_STORAGE_KEY, closureTimestamp.toString());
    browser.storage.local.set({ [LAST_PAGE_CLOSURE_STORAGE_KEY]: closureTimestamp }).catch(err => console.error(err));
  },
  true
);

function getOpenedTemplePagesN() {
  const windowsN = browser.extension.getViews().length;
  const bgWindow: Window | null = browser.extension.getBackgroundPage();
  return bgWindow ? windowsN - 1 : windowsN;
}

async function lock() {
  const res = await request({
    type: TempleMessageType.LockRequest
  });
  assertResponse(res.type === TempleMessageType.LockResponse);
}
