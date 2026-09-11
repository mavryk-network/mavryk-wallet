import { z } from 'zod';

import { createEntity } from 'lib/store';
import { readLegacyAssetsSource } from 'lib/store/zustand/legacy-assets-source';
import { decodeLegacyUIRoot } from 'lib/store/zustand/legacy-ui-source';
import { BROWSER_STORAGE } from 'lib/store/zustand/persist-storage';
import { parseData, SAFE_KEY_SCHEMA } from 'lib/store/zustand/validation';

import { initialState, SliceState } from './state';

const securitySchema = z.object({
  mainnetWhitelist: z.object({ data: z.array(SAFE_KEY_SCHEMA) }),
  mainnetScamlist: z.object({ data: z.record(SAFE_KEY_SCHEMA, z.boolean()) })
});

/** Seed the existing offline security caches once; subsequent Redux writes use the active task11 root. */
export async function restoreAssetSecurity(current: unknown): Promise<SliceState> {
  let raw = current;
  if (raw === undefined) {
    const legacy = await readLegacyAssetsSource('persist:root.assets', BROWSER_STORAGE, async key =>
      localStorage.getItem(key)
    );
    if (legacy !== undefined) raw = decodeLegacyUIRoot(legacy);
  }
  if (raw === undefined) return initialState;
  const security = parseData(securitySchema, raw);
  return {
    ...initialState,
    mainnetWhitelist: createEntity(security.mainnetWhitelist.data),
    mainnetScamlist: createEntity(security.mainnetScamlist.data)
  };
}

/** Persist only Redux-owned server security data, never another copy of migrated asset records. */
export function persistAssetSecurity(state: SliceState): SliceState {
  return {
    ...initialState,
    mainnetWhitelist: createEntity(state.mainnetWhitelist.data),
    mainnetScamlist: createEntity(state.mainnetScamlist.data)
  };
}
