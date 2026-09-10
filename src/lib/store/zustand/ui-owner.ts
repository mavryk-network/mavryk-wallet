import isEqual from 'lodash/isEqual';
import browser from 'webextension-polyfill';

import { createLegacyUIMigration } from './legacy-ui-migration';
import { metadataStore } from './metadata.store';
import { BROWSER_STORAGE } from './persist-storage';
import { UI_OWNER_CHANNEL, UI_REQUEST_SCHEMA, UI_SNAPSHOT_SCHEMA, UICommand } from './ui-owner.contract';
import { applyUIPreferences } from './ui-preferences.helpers';
import { uiStore } from './ui.store';
import { parseData } from './validation';

let fallback: string | null | undefined;
const migration = createLegacyUIMigration({
  ui: uiStore,
  metadata: metadataStore,
  storage: BROWSER_STORAGE,
  readFallback: async () => {
    if (fallback === undefined) throw new Error('fallback-required');
    return fallback;
  }
});
let queue: Promise<unknown> = Promise.resolve();
let isStarted = false;
let hasWriteFailure = false;
let pendingOperations = 0;

/** Background-only authority; every command and read is serialized behind successful migration and durable writes. */
async function processCommand(command?: UICommand) {
  await migration.initialize();
  // Explicit retries drain retained failed snapshots before accepting more commands.
  await Promise.all([uiStore.persistence.flush(), metadataStore.persistence.flush()]);
  if (command?.kind === 'preferences') {
    uiStore.persistence
      .prepare(draft => {
        applyUIPreferences(draft, command.values);
      })
      .commit();
  } else if (command?.kind === 'metadata') {
    metadataStore.persistence
      .prepare(draft => {
        for (const [slug, metadata] of Object.entries(command.records)) {
          const current = draft.tokensMetadata[slug];
          if (command.mode === 'whitelist' && current) continue;
          if (command.mode === 'refresh') {
            if (!current) continue;
            current.artifactUri = metadata.artifactUri;
            current.displayUri = metadata.displayUri;
          } else draft.tokensMetadata[slug] = metadata;
        }
      })
      .commit();
  }
  await Promise.all([uiStore.persistence.flush(), metadataStore.persistence.flush()]);
  const snapshot = parseData(
    UI_SNAPSHOT_SCHEMA,
    JSON.parse(JSON.stringify({ ui: uiStore.getState(), metadata: metadataStore.getState() }))
  );
  const [ui, metadata] = await Promise.all([uiStore.persistence.readBack(), metadataStore.persistence.readBack()]);
  if (!isEqual(ui?.state, snapshot.ui) || !isEqual(metadata?.state, snapshot.metadata)) {
    throw new Error('Owner durable read-back failed');
  }
  hasWriteFailure = false;
  return snapshot;
}

/** Disabled analytics callers may proceed only with the owner's adopted durable identity and consent. */
export const getReadyAnalyticsIdentity = () =>
  migration.isReady() && pendingOperations === 0 && !hasWriteFailure && uiStore.getState().isAnalyticsEnabled
    ? uiStore.getState().userId
    : null;

/** Register synchronously before background awaits wallet initialization. Extension pages alone can send commands. */
export function startUIOwner() {
  if (isStarted) return;
  isStarted = true;
  browser.runtime.onMessage.addListener((raw, sender) => {
    if (raw?.channel !== UI_OWNER_CHANNEL) return undefined;
    if (sender.id !== browser.runtime.id || !sender.url?.startsWith(browser.runtime.getURL(''))) {
      return Promise.resolve({ error: 'Preference owner request denied' });
    }
    pendingOperations++;
    const run = queue
      .then(async () => {
        const request = parseData(UI_REQUEST_SCHEMA, raw);
        if (request.fallback !== undefined && fallback === undefined) fallback = request.fallback;
        const snapshot = await processCommand(request.command);
        fallback = undefined;
        return { snapshot };
      })
      .catch(error => {
        hasWriteFailure = true;
        fallback = undefined;
        // Never expose source payloads/schema errors (which may contain profile data).
        return {
          error:
            error instanceof Error && error.message === 'fallback-required'
              ? 'fallback-required'
              : 'Preferences could not be restored or saved. Retry after fixing storage.'
        };
      });
    const settled = run.finally(() => {
      pendingOperations--;
    });
    queue = settled;
    return settled;
  });
}
