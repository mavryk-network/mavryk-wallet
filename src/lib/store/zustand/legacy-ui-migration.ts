import isEqual from 'lodash/isEqual';
import { nanoid } from 'nanoid';

import { ANALYTICS_USER_ID_STORAGE_KEY } from 'lib/constants';

import { awaitStoresHydrated } from './await-stores-hydrated';
import { commitStagedWrites } from './destination-store';
import { ANALYTICS_ID_SCHEMA, LEGACY_UI_ROOT_KEY, parseLegacyUIRoot } from './legacy-ui-source';
import type { createMetadataStore } from './metadata.store';
import { BrowserStorage } from './persist-storage';
import { applyUIPreferences } from './ui-preferences.helpers';
import { UI_SCHEMA } from './ui-state.schema';
import type { createUIStore } from './ui.store';

/** One instance in the background owner. Failed/interrupted attempts replay retained legacy input before exposing consumers. */
export function createLegacyUIMigration(options: {
  ui: ReturnType<typeof createUIStore>;
  metadata: ReturnType<typeof createMetadataStore>;
  storage: BrowserStorage;
  readFallback: () => Promise<string | null>;
  generateId?: () => string;
}) {
  const { ui, metadata, storage } = options;
  let attempt: Promise<void> | undefined;
  let isReady = false;
  const run = async () => {
    // Retry only failed hydration. Successful hydration must never overwrite newer destination writes.
    if (ui.hydration.getError() !== undefined) await ui.hydration.retry();
    if (metadata.hydration.getError() !== undefined) await metadata.hydration.retry();
    await awaitStoresHydrated(ui, metadata);
    const durableUI = await ui.persistence.readBack();
    const durableMetadata = await metadata.persistence.readBack();
    const idRecord = await storage.get(ANALYTICS_USER_ID_STORAGE_KEY);
    const rawId = idRecord[ANALYTICS_USER_ID_STORAGE_KEY];
    const durableId = rawId === undefined || rawId === null ? null : ANALYTICS_ID_SCHEMA.parse(rawId);

    if (durableUI?.state.legacyMigrated) {
      if (!durableMetadata || !durableId || durableId !== durableUI.state.userId) {
        throw new Error('Completed preference migration has inconsistent durable destinations');
      }
      isReady = true;
      return;
    }

    // Browser source has precedence. Null, malformed data and rejected reads never fall back.
    const rootRecord = await storage.get(LEGACY_UI_ROOT_KEY);
    let rawRoot = rootRecord[LEGACY_UI_ROOT_KEY];
    if (rawRoot === undefined) {
      const fallback = await options.readFallback();
      rawRoot = fallback === null ? undefined : fallback;
    }
    const source = parseLegacyUIRoot(rawRoot === undefined ? {} : rawRoot);
    const existingId = durableId ?? source.preferences.userId ?? durableUI?.state.userId;
    const userId = ANALYTICS_ID_SCHEMA.parse(existingId ?? (options.generateId ?? nanoid)());
    let expectedUI = UI_SCHEMA.parse(ui.getState());
    const uiDraft = ui.persistence.prepare(draft => {
      applyUIPreferences(draft, source.preferences);
      draft.userId = userId;
      draft.legacyMigrated = false;
      expectedUI = UI_SCHEMA.parse(draft);
    });
    const metadataDraft = metadata.persistence.prepare(draft => {
      for (const [slug, value] of Object.entries(source.metadata)) draft.tokensMetadata[slug] = value;
    });
    // Both prepares validate before any memory update or persistence enqueue.
    commitStagedWrites(uiDraft, metadataDraft);
    await Promise.all([ui.persistence.flush(), metadata.persistence.flush()]);
    const writtenUI = await ui.persistence.readBack();
    const writtenMetadata = await metadata.persistence.readBack();
    if (!isEqual(writtenUI?.state, JSON.parse(JSON.stringify(expectedUI))) || !writtenMetadata)
      throw new Error('Migration read-back failed');
    for (const [slug, value] of Object.entries(metadata.getState().tokensMetadata)) {
      if (!isEqual(writtenMetadata.state.tokensMetadata[slug], JSON.parse(JSON.stringify(value))))
        throw new Error('Metadata read-back failed');
    }
    // The browser set promise is the ID flush; independently read its value before the completion write.
    if (durableId !== userId) await storage.set({ [ANALYTICS_USER_ID_STORAGE_KEY]: userId });
    if ((await storage.get(ANALYTICS_USER_ID_STORAGE_KEY))[ANALYTICS_USER_ID_STORAGE_KEY] !== userId) {
      throw new Error('Analytics identity read-back failed');
    }
    commitStagedWrites(
      ui.persistence.prepare(draft => {
        draft.legacyMigrated = true;
      })
    );
    await ui.persistence.flush();
    expectedUI.legacyMigrated = true;
    if (!isEqual((await ui.persistence.readBack())?.state, JSON.parse(JSON.stringify(expectedUI))))
      throw new Error('Completion read-back failed');
    isReady = true;
  };
  return {
    isReady: () => isReady,
    initialize(): Promise<void> {
      if (isReady) return Promise.resolve();
      if (!attempt)
        attempt = run().finally(() => {
          attempt = undefined;
        });
      return attempt;
    }
  };
}
