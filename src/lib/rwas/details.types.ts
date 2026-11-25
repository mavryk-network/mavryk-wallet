import { TzktRWAAssetMetadata } from 'lib/apis/tzkt/types';
import type { CollectibleDetails } from 'lib/collectibles/details.types';
import type { WalletRwaPricing } from 'mavryk/api/rwas';

export type RwaDetails = TzktRWAAssetMetadata & {
  isAdultContent?: boolean;
  /** Wallet-row pricing; absent fields are treated as unavailable. */
  pricing?: WalletRwaPricing;
  /** Optional legacy listing; wallet API details do not supply an Objkt price. */
  listing?: CollectibleDetails['listing'];
};

/** `null` for no available asset details */
export type RwaDetailsRecord = Record<string, RwaDetails | null>;
