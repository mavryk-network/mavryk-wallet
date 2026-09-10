import { useSyncExternalStore } from 'react';

import browser from 'webextension-polyfill';

import { LEGACY_UI_ROOT_KEY } from './legacy-ui-source';
import { UI_OWNER_CHANNEL, UI_SNAPSHOT_SCHEMA, UICommand, UISnapshot } from './ui-owner.contract';
import { parseData } from './validation';

let snapshot: UISnapshot | undefined;
let error: Error | undefined;
let pending: Promise<void> | undefined;
let isListening = false;
let queue: Promise<unknown> = Promise.resolve();
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
  if (!response || response.error) throw new Error(response?.error ?? 'Preference owner unavailable');
  snapshot = parseData(UI_SNAPSHOT_SCHEMA, response.snapshot);
  error = undefined;
  notify();
}

/** Queue commands without optimistic defaults; failures close the consumer gate and remain explicitly retryable. */
export function updateOwnedUI(command?: UICommand): Promise<void> {
  const run = queue
    .then(() => send(command))
    .catch(() => {
      error = new Error('Preferences could not be restored or saved. Please retry.');
      notify();
      throw error;
    });
  queue = run.catch(() => undefined);
  return run;
}

/** Read-only frontend projection of the background's durable stores; no foreground persistence adapter exists. */
export function initializeOwnedUI(): Promise<void> {
  if (!isListening) {
    isListening = true;
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes['zustand-ui'] || changes['zustand-metadata'])) {
        void updateOwnedUI().catch(() => undefined); // Error is exposed by the gate, never treated as readiness.
      }
    });
  }
  if (!pending)
    pending = updateOwnedUI().finally(() => {
      pending = undefined;
    });
  return pending;
}

export function getOwnedUISnapshot(): UISnapshot {
  if (error) throw error;
  if (!snapshot) throw new Error('Await preference migration readiness');
  return snapshot;
}

export function useOwnedUI<T>(selector: (state: UISnapshot) => T): T {
  useSyncExternalStore(subscribe, () => snapshot);
  return selector(getOwnedUISnapshot());
}

export function useOwnedUIStatus() {
  const current = useSyncExternalStore(subscribe, () => error ?? snapshot);
  return { isReady: !!current && !(current instanceof Error), error: current instanceof Error ? current : undefined };
}
