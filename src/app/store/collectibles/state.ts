import type { CollectibleDetailsRecord } from 'lib/collectibles/details.types';
import { createEntity, LoadableEntityState } from 'lib/store';

// Retained type contract for legacy action/reducer imports.
export type { CollectibleDetails, CollectibleDetailsRecord } from 'lib/collectibles/details.types';

export interface CollectiblesState {
  details: LoadableEntityState<CollectibleDetailsRecord>;
  adultFlags: Record<string, AdultFlag>;
}

interface AdultFlag {
  val: boolean;
  /** Timestamp in seconds */
  ts: number;
}

export const collectiblesInitialState: CollectiblesState = {
  details: createEntity({}),
  adultFlags: {}
};
