import { TzktRWAAssetMetadata } from 'lib/apis/tzkt/types';
import { createEntity, LoadableEntityState } from 'lib/store';

// TODO check UserObjktCollectible
export type RwaDetails = TzktRWAAssetMetadata & {
  isAdultContent?: boolean;
};

/** `null` for no available asset details */
export type RwaDetailsRecord = Record<string, RwaDetails | null>;

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
