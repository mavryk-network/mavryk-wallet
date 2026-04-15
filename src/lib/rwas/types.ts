import { MvktRWAAssetMetadata } from 'lib/apis/mvkt/types';

export type RwaDetails = MvktRWAAssetMetadata & {
  isAdultContent?: boolean;
  metadataHash?: string | null;
};

/** `null` for no available asset details */
export type RwaDetailsRecord = Record<string, RwaDetails | null>;
