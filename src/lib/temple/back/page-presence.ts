import browser, { Runtime } from 'webextension-polyfill';

import { LAST_PAGE_CLOSURE_STORAGE_KEY } from 'lib/constants';
import { WALLET_AUTOLOCK_TIME } from 'lib/fixed-times';
import { classifyIntercomPort, isTrustedUiPortInfo } from 'lib/intercom';

/** Margin so the deadline check never runs a moment before WALLET_AUTOLOCK_TIME has fully elapsed */
const DEADLINE_MARGIN_MS = 1_000;

const openPages = new Set<Runtime.Port>();
let deadlineTimeout: ReturnType<typeof setTimeout> | undefined;
let onAutolockDeadline: (() => Promise<void>) | undefined;

export const hasOpenExtensionPages = () => openPages.size > 0;

/** Runs the deadline check once WALLET_AUTOLOCK_TIME has passed since `closureTimestamp`, unless a page opens first */
export function scheduleAutolockDeadline(closureTimestamp: number) {
  const onDeadline = onAutolockDeadline;
  if (!onDeadline || hasOpenExtensionPages()) return;

  if (deadlineTimeout) clearTimeout(deadlineTimeout);
  deadlineTimeout = setTimeout(
    () => onDeadline().catch(err => console.error(err)),
    Math.max(0, closureTimestamp + WALLET_AUTOLOCK_TIME + DEADLINE_MARGIN_MS - Date.now())
  );
}

/**
 * Tracks open extension pages through their intercom ports, so the background records the last page closure
 * itself instead of relying on a page-side `pagehide` write. Must be called synchronously at background startup.
 */
export function startPagePresenceTracking(onDeadline: () => Promise<void>, onFirstPage: () => Promise<void>) {
  onAutolockDeadline = onDeadline;
  browser.runtime.onConnect.addListener(port => {
    if (port.name !== 'INTERCOM' || !isTrustedUiPortInfo(classifyIntercomPort(port))) return;

    const isFirstPage = !hasOpenExtensionPages();
    openPages.add(port);
    if (deadlineTimeout) clearTimeout(deadlineTimeout);
    // The deadline may have passed while no page was open (e.g. an evicted worker); check it before clearing
    if (isFirstPage) {
      onFirstPage()
        .then(() => (hasOpenExtensionPages() ? browser.storage.local.remove(LAST_PAGE_CLOSURE_STORAGE_KEY) : undefined))
        .catch(err => console.error(err));
    }

    port.onDisconnect.addListener(() => {
      openPages.delete(port);
      if (hasOpenExtensionPages()) return;

      const closureTimestamp = Date.now();
      browser.storage.local.set({ [LAST_PAGE_CLOSURE_STORAGE_KEY]: closureTimestamp }).catch(err => console.error(err));
      // A service worker may be stopped before this fires; every vault restore path enforces the deadline then
      scheduleAutolockDeadline(closureTimestamp);
    });
  });
}
