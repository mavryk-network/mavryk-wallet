import type { UserObjktCollectible } from 'lib/apis/objkt';
import { createEntity, LoadableEntityState } from 'lib/store';

// TODO check UserObjktCollectible
export interface RwaDetails extends Pick<UserObjktCollectible, 'fa' | 'description' | 'mime'> {
  metadataHash: string | null;
  /** Minted on date.
   * ISO String (e.g. `2023-05-30T09:40:33+00:00`)
   */
  mintedTimestamp: string;
  /** Editions */
  supply: number;
  /** Cheepest listing */
  listing: null | RwaDetailsListing;
  /** Highest offer */
  objktArtifactUri: string;
  creators: RwaDetailsCreator[];
  galleries: RwaDetailsGallery[];
  isAdultContent: boolean;
  /** Percents */
  royalties?: number;
  attributes: RwaDetailsAttribute[];
}

interface RwaDetailsListing {
  /** In atoms */
  floorPrice: number;
  currencyId: number;
}

interface RwaDetailsCreator {
  address: string;
  tzDomain: string;
}

interface RwaDetailsGallery {
  title: string;
}

type RwaDetailsAttribute = UserObjktCollectible['attributes'][number]['attribute'] & {
  /** Percent */
  rarity: number;
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
