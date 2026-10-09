import { TzktRWAAssetMetadata } from 'lib/apis/tzkt/types';

export type RwaDetails = TzktRWAAssetMetadata & {
  isAdultContent?: boolean;
};

/** `null` for no available asset details */
export type RwaDetailsRecord = Record<string, RwaDetails | null>;
