import isEqual from 'lodash/isEqual';

import { ASSETS_SCHEMA } from './assets-state.schema';
import type { createAssetsStore } from './assets.store';
import { decodeLegacyUIRoot } from './legacy-ui-source';
import { OwnerFallbackKey } from './owner-fallback';
import { BrowserStorage } from './persist-storage';
import { LEGACY_SECURITY_SCHEMA } from './security-state.schema';
import { parseData } from './validation';

/** Adopt security independently of Task 13. Sources remain intact, including after partial writes. */
export function createSecurityMigration(options: {
  assets: ReturnType<typeof createAssetsStore>;
  storage: BrowserStorage;
  readFallback: (key: OwnerFallbackKey) => Promise<string | null>;
}) {
  const { assets, storage, readFallback } = options;
  let isReady = false;
  const read = async (key: OwnerFallbackKey) => {
    const result = await storage.get(key);
    if (result[key] !== undefined) return decodeLegacyUIRoot(result[key]);
    const fallback = await readFallback(key);
    return fallback === null ? undefined : decodeLegacyUIRoot(fallback);
  };
  const verify = async () => {
    const expected = parseData(ASSETS_SCHEMA, assets.getState());
    await assets.persistence.flush();
    if (!isEqual((await assets.persistence.readBack())?.state, expected))
      throw new Error('Security adoption read-back failed');
  };
  return {
    isReady: () => isReady,
    async initialize() {
      if (isReady) return;
      // The owner calls this after successful Task 13 hydration and serializes every attempt.
      await assets.persistence.flush();
      const durable = await assets.persistence.readBack();
      if (!durable) throw new Error('Security destination missing');
      if (!durable.state.isSecurityAdopted) {
        const active = await read('persist:temple-root-task11');
        const raw =
          active?.assets === undefined ? await read('persist:root.assets') : decodeLegacyUIRoot(active.assets);
        const source = raw === undefined ? undefined : parseData(LEGACY_SECURITY_SCHEMA, raw);
        assets.persistence
          .prepare(draft => {
            // Old Redux defaults have no success marker. An empty legacy list cannot prove a completed fetch.
            if (draft.mainnetWhitelist === null && source?.mainnetWhitelist.data.length)
              draft.mainnetWhitelist = source.mainnetWhitelist.data;
            if (draft.mainnetScamlist === null && source && Object.keys(source.mainnetScamlist.data).length)
              draft.mainnetScamlist = source.mainnetScamlist.data;
          })
          .commit();
        await verify();
        assets.persistence
          .prepare(draft => {
            draft.isSecurityAdopted = true;
          })
          .commit();
      }
      await verify();
      isReady = true;
    }
  };
}
