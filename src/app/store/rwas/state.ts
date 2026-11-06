import type { RwaDetailsRecord } from 'lib/rwas/details.types';
import { createEntity, LoadableEntityState } from 'lib/store';

// Retained type contract for legacy action/reducer imports.
export type { RwaDetails, RwaDetailsRecord } from 'lib/rwas/details.types';

export interface RwasState {
  details: LoadableEntityState<RwaDetailsRecord>;
  adultFlags: Record<string, AdultFlag>;
}

interface AdultFlag {
  val: boolean;
  /** Timestamp in seconds */
  ts: number;
}

export const rwasInitialState: RwasState = {
  details: createEntity({}),
  adultFlags: {}
};
