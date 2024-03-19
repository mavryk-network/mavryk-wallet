import type { UserObjktNFT } from 'lib/apis/objkt';
import { createEntity, LoadableEntityState } from 'lib/store';

export interface NFTDetails extends Pick<UserObjktNFT, 'fa' | 'description' | 'mime'> {
  metadataHash: string | null;
  /** Minted on date.
   * ISO String (e.g. `2023-05-30T09:40:33+00:00`)
   */
  mintedTimestamp: string;
  /** Editions */
  supply: number;
  /** Cheepest listing */
  listing: null | NFTDetailsListing;
  /** Highest offer */
  objktArtifactUri: string;
  offers: UserObjktNFT['offers_active'];
  creators: NFTDetailsCreator[];
  galleries: NFTDetailsGallery[];
  isAdultContent: boolean;
  /** Percents */
  royalties?: number;
  attributes: NFTDetailsAttribute[];
}

interface NFTDetailsListing {
  /** In atoms */
  floorPrice: number;
  currencyId: number;
}

interface NFTDetailsCreator {
  address: string;
  tzDomain: string;
}

interface NFTDetailsGallery {
  title: string;
}

type NFTDetailsAttribute = UserObjktNFT['attributes'][number]['attribute'] & {
  /** Percent */
  rarity: number;
};

/** `null` for no available asset details */
export type NFTDetailsRecord = Record<string, NFTDetails | null>;

export interface NFTsState {
  details: LoadableEntityState<NFTDetailsRecord>;
  adultFlags: Record<string, AdultFlag>;
}

interface AdultFlag {
  val: boolean;
  /** Timestamp in seconds */
  ts: number;
}

export const nftsInitialState: NFTsState = {
  details: createEntity({}),
  adultFlags: {}
};
