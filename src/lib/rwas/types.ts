import { TzktRWAAssetMetadata } from 'lib/apis/tzkt/types';

export type RwaDetails = TzktRWAAssetMetadata & {
  isAdultContent?: boolean;
  metadataHash?: string | null;
};

/** `null` for no available asset details */
export type RwaDetailsRecord = Record<string, RwaDetails | null>;
