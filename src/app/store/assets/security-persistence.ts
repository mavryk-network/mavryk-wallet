import { createEntity } from 'lib/store';
import { LEGACY_SECURITY_SCHEMA } from 'lib/store/zustand/security-state.schema';
import { parseData } from 'lib/store/zustand/validation';

import { initialState, SliceState } from './state';

/** Retain the active Redux source for rollback only; security adoption now belongs to the background owner. */
export async function restoreAssetSecurity(current: unknown): Promise<SliceState> {
  if (current === undefined) return initialState;
  const security = parseData(LEGACY_SECURITY_SCHEMA, current);
  return {
    ...initialState,
    mainnetWhitelist: createEntity(security.mainnetWhitelist.data),
    mainnetScamlist: createEntity(security.mainnetScamlist.data)
  };
}

/** Preserve the retained Redux security source without mirroring current owner data. */
export function persistAssetSecurity(state: SliceState): SliceState {
  return {
    ...initialState,
    mainnetWhitelist: createEntity(state.mainnetWhitelist.data),
    mainnetScamlist: createEntity(state.mainnetScamlist.data)
  };
}
