import isEqual from 'lodash/isEqual';
import browser from 'webextension-polyfill';

import { ASSET_SCOPE_STORAGE_KEYS } from 'lib/assets/scoped-wallet-request';

import { applyAssetsCommand } from './assets-command';
import { applyAssetsSyncCommand } from './assets-sync-command';
import { assetsStore } from './assets.store';
import { createLegacyAssetsMigration } from './legacy-assets-migration';
import { createLegacyUIMigration } from './legacy-ui-migration';
import { applyMetadataRecords, reserveMetadataRevision } from './metadata-command';
import { metadataStore } from './metadata.store';
import { OwnerFallbackKey } from './owner-fallback';
import { BROWSER_STORAGE } from './persist-storage';
import { createSecurityMigration } from './security-migration';
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
let assetsFallback: Partial<Record<OwnerFallbackKey, string | null>> = {};
let requestedFallbackKey: OwnerFallbackKey | undefined;
const assetsMigration = createLegacyAssetsMigration({
  ui: uiStore,
  metadata: metadataStore,
  assets: assetsStore,
  storage: BROWSER_STORAGE,
  readFallback: readAssetsFallback
});
const securityMigration = createSecurityMigration({
  assets: assetsStore,
  storage: BROWSER_STORAGE,
  readFallback: readAssetsFallback
});
async function readAssetsFallback(key: OwnerFallbackKey) {
  const value = assetsFallback[key];
  if (value === undefined) {
    requestedFallbackKey = key;
    throw new Error('assets-fallback-required');
  }
  return value;
}
let queue: Promise<unknown> = Promise.resolve();
let isStarted = false;
let hasWriteFailure = false;
let pendingOperations = 0;
let selectionRevision = 0;
const assetRequests = new Map<string, { id: string; selectionRevision: number; metadataRevision: number }>();
const metadataRequests = new Map<string, { scopeKey: string; revision: number; selectionRevision: number }>();

/** Background-only authority; every command and read is serialized behind successful migration and durable writes. */
async function processCommand(command?: UICommand) {
  await migration.initialize();
  await assetsMigration.initialize();
  await securityMigration.initialize();
  // Explicit retries drain retained failed snapshots before accepting more commands.
  await Promise.all([uiStore.persistence.flush(), metadataStore.persistence.flush(), assetsStore.persistence.flush()]);
  if (command?.kind === 'metadata-sync-start') {
    let revision = 0;
    metadataStore.persistence
      .prepare(draft => {
        revision = reserveMetadataRevision(draft);
      })
      .commit();
    metadataRequests.set(command.requestId, { scopeKey: command.scopeKey, revision, selectionRevision });
  } else if (command?.kind === 'metadata-sync-cancel') {
    metadataRequests.delete(command.requestId);
  } else if (command?.kind === 'metadata-sync' || command?.kind === 'metadata-save') {
    const request = command.kind === 'metadata-sync' ? metadataRequests.get(command.requestId) : undefined;
    if (
      command.kind === 'metadata-save' ||
      (request && request.scopeKey === command.scopeKey && request.selectionRevision === selectionRevision)
    ) {
      metadataStore.persistence
        .prepare(draft => {
          const isComplete = applyMetadataRecords(
            draft,
            command.category,
            command.records,
            command.kind === 'metadata-save' ? 'put' : command.mode,
            command.scopeKey,
            request?.revision
          );
          if (command.kind === 'metadata-sync' && isComplete) draft.lastReceipt = command.requestId;
        })
        .commit();
    }
    if (command.kind === 'metadata-sync') metadataRequests.delete(command.requestId);
  } else if (
    command &&
    (command.kind === 'assets-sync-start' ||
      command.kind === 'assets-sync' ||
      command.kind === 'scamlist-sync' ||
      command.kind === 'whitelist-sync')
  ) {
    if (command.kind === 'assets-sync-start') {
      let metadataRevision = 0;
      metadataStore.persistence
        .prepare(draft => {
          metadataRevision = reserveMetadataRevision(draft);
        })
        .commit();
      assetRequests.set(command.requestKey, { id: command.requestId, selectionRevision, metadataRevision });
    }
    const request = assetRequests.get(command.requestKey);
    if (
      command.kind === 'assets-sync' &&
      (!request || request.id !== command.requestId || request.selectionRevision !== selectionRevision)
    ) {
      // A queued response must not publish across a selection transition, even A→B→A or a background restart.
      assetsStore.persistence
        .prepare(draft => {
          if (draft.syncRequests[command.requestKey] === command.requestId)
            delete draft.syncRequests[command.requestKey];
        })
        .commit();
    } else
      applyAssetsSyncCommand(
        command,
        { ui: uiStore, assets: assetsStore, metadata: metadataStore },
        request?.metadataRevision
      );
  } else if (command?.kind === 'preferences') {
    uiStore.persistence
      .prepare(draft => {
        applyUIPreferences(draft, command.values);
      })
      .commit();
  } else if (command?.kind === 'metadata') {
    metadataStore.persistence
      .prepare(draft => {
        applyMetadataRecords(draft, 'tokens', command.records, command.mode);
      })
      .commit();
  } else if (command?.kind === 'indexeddb-assets-migration') {
    const { runIndexedDBAssetsMigration } = await import('lib/assets/indexeddb-migration-owner');
    await runIndexedDBAssetsMigration({ ui: uiStore, metadata: metadataStore, assets: assetsStore });
  } else if (command) applyAssetsCommand(command, { ui: uiStore, metadata: metadataStore, assets: assetsStore });
  await Promise.all([uiStore.persistence.flush(), metadataStore.persistence.flush(), assetsStore.persistence.flush()]);
  const snapshot = parseData(
    UI_SNAPSHOT_SCHEMA,
    JSON.parse(
      JSON.stringify({ ui: uiStore.getState(), metadata: metadataStore.getState(), assets: assetsStore.getState() })
    )
  );
  const [ui, metadata, assets] = await Promise.all([
    uiStore.persistence.readBack(),
    metadataStore.persistence.readBack(),
    assetsStore.persistence.readBack()
  ]);
  if (
    !isEqual(ui?.state, snapshot.ui) ||
    !isEqual(metadata?.state, snapshot.metadata) ||
    !isEqual(assets?.state, snapshot.assets)
  ) {
    throw new Error('Owner durable read-back failed');
  }
  hasWriteFailure = false;
  return snapshot;
}

/** Disabled analytics callers may proceed only with the owner's adopted durable identity and consent. */
export const getReadyAnalyticsIdentity = () =>
  migration.isReady() &&
  assetsMigration.isReady() &&
  securityMigration.isReady() &&
  pendingOperations === 0 &&
  !hasWriteFailure &&
  uiStore.getState().isAnalyticsEnabled
    ? uiStore.getState().userId
    : null;

/** Register synchronously before background awaits wallet initialization. Extension pages alone can send commands. */
export function startUIOwner() {
  if (isStarted) return;
  isStarted = true;
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && ASSET_SCOPE_STORAGE_KEYS.some(key => key in changes)) selectionRevision++;
  });
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
        if (request.assetsFallback) Object.assign(assetsFallback, request.assetsFallback);
        const snapshot = await processCommand(request.command);
        assetsFallback = {};
        fallback = undefined;
        return { snapshot };
      })
      .catch(error => {
        hasWriteFailure = true;
        if (error instanceof Error && error.message === 'assets-fallback-required') {
          return { error: 'assets-fallback-required', key: requestedFallbackKey };
        }
        assetsFallback = {};
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
