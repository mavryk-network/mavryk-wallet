import { useSyncExternalStore } from 'react';

import { replaceEqualDeep } from '@tanstack/react-query';
import browser from 'webextension-polyfill';

import { LEGACY_UI_ROOT_KEY } from './legacy-ui-source';
import { OWNER_FALLBACK_KEYS, OwnerFallbackKey } from './owner-fallback';
import { UI_OWNER_CHANNEL, UI_SNAPSHOT_SCHEMA, UICommand, UISnapshot } from './ui-owner.contract';
import { parseData } from './validation';

let snapshot: UISnapshot | undefined;
let error: Error | undefined;
let pending: Promise<void> | undefined;
let earlyInitialization: Promise<void> | undefined;
let isListening = false;
let queue: Promise<unknown> = Promise.resolve();
let queuedCount = 0;
let isRefreshQueued = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

async function send(command?: UICommand) {
  let response = await browser.runtime.sendMessage({ channel: UI_OWNER_CHANNEL, command });
  if (response?.error === 'fallback-required') {
    // Read only when browser storage was successfully read and the legacy root was absent.
    const fallback = localStorage.getItem(LEGACY_UI_ROOT_KEY);
    response = await browser.runtime.sendMessage({ channel: UI_OWNER_CHANNEL, fallback, command });
  }
  const assetsFallback: Partial<Record<OwnerFallbackKey, string | null>> = {};
  while (response?.error === 'assets-fallback-required') {
    const key = response.key as OwnerFallbackKey;
    if (!OWNER_FALLBACK_KEYS.includes(key) || key in assetsFallback) throw new Error('Invalid fallback request');
    assetsFallback[key] = localStorage.getItem(key);
    response = await browser.runtime.sendMessage({ channel: UI_OWNER_CHANNEL, assetsFallback, command });
  }
  if (!response || response.error) throw new Error(response?.error ?? 'Preference owner unavailable');
  // Unchanged slices keep their previous identity, so selectors bail out and an identical response notifies nobody.
  const next = replaceEqualDeep(snapshot, parseData(UI_SNAPSHOT_SCHEMA, response.snapshot));
  const isChanged = next !== snapshot || error !== undefined;
  snapshot = next;
  error = undefined;
  if (isChanged) notify();
  return snapshot;
}

/** Queue commands without optimistic defaults; failures close the consumer gate and remain explicitly retryable. */
export function requestOwnedUISnapshot(command?: UICommand): Promise<UISnapshot> {
  return enqueue(() => send(command));
}

function enqueue(request: () => Promise<UISnapshot>): Promise<UISnapshot> {
  // An idle queue sends synchronously, so the page-entry request leaves before the app bundle finishes evaluating.
  const sent = queuedCount === 0 ? request() : queue.then(request);
  queuedCount++;
  const run = sent.catch(() => {
    error = new Error('Preferences could not be restored or saved. Please retry.');
    notify();
    throw error;
  });
  queue = run
    .catch(() => undefined)
    .finally(() => {
      queuedCount--;
    });
  return run;
}

/**
 * Refresh after a destination storage change. A refresh that is still queued has not been sent yet, so it will read
 * the owner's state including this change; a second one would only repeat it.
 */
function refreshOwnedUI() {
  if (isRefreshQueued) return;
  isRefreshQueued = true;
  void enqueue(() => {
    isRefreshQueued = false;
    return send();
  }).catch(() => undefined); // Error is exposed by the gate, never treated as readiness.
}

/** Apply a command and await the owner’s durable acknowledgement. */
export async function updateOwnedUI(command?: UICommand): Promise<void> {
  await requestOwnedUISnapshot(command);
}

/** Read-only frontend projection of the background's durable stores; no foreground persistence adapter exists. */
export function initializeOwnedUI(): Promise<void> {
  if (earlyInitialization) {
    // Adopt the request started at page entry exactly once; a later call (retry) asks the owner again.
    const adopted = earlyInitialization;
    earlyInitialization = undefined;
    return adopted;
  }
  if (!isListening) {
    isListening = true;
    browser.storage.onChanged.addListener((changes, area) => {
      if (
        area === 'local' &&
        (changes['zustand-ui'] ||
          changes['zustand-metadata'] ||
          changes['zustand-assets'] ||
          changes['zustand-balances'])
      ) {
        refreshOwnedUI();
      }
    });
  }
  if (!pending)
    pending = updateOwnedUI().finally(() => {
      pending = undefined;
    });
  return pending;
}

/**
 * Send the first owner snapshot request at page entry, before the app bundle evaluates, so a cold worker boots in
 * parallel. Readiness is unchanged: StoreProvider still gates on this same request via `initializeOwnedUI`.
 */
export function startOwnedUIInitialization() {
  if (earlyInitialization) return;
  const started = initializeOwnedUI();
  started.catch(() => undefined); // Failure is surfaced to StoreProvider when it adopts the request.
  earlyInitialization = started;
}

export function getOwnedUISnapshot(): UISnapshot {
  if (error) throw error;
  if (!snapshot) throw new Error('Await preference migration readiness');
  return snapshot;
}

/** Selectors must return snapshot slices, primitives or constants; a component re-renders only when its slice changes. */
export function useOwnedUI<T>(selector: (state: UISnapshot) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getOwnedUISnapshot()));
}

export function useOwnedUIStatus() {
  const current = useSyncExternalStore(subscribe, () => error ?? snapshot);
  return { isReady: !!current && !(current instanceof Error), error: current instanceof Error ? current : undefined };
}
