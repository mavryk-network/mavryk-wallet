import { getOwnedUISnapshot } from 'lib/store/zustand/ui-client';
import type { UISnapshot } from 'lib/store/zustand/ui-owner.contract';
import { TempleChainId } from 'lib/temple/types';

import { getMetadataScopeKey, MetadataCategory, MetadataScope, WHITELIST_METADATA_SCOPE_KEY } from './metadata-scope';
import type { AssetMetadataBase } from './types';

const toMetadataField = (category: MetadataCategory) => `${category}Metadata` as const;

/** Retained unscoped records of unknown provenance; the lowest-trust non-seed source. */
export const selectLegacyMetadata = (state: UISnapshot, category: MetadataCategory) =>
  state.metadata[toMetadataField(category)];

/** Fetched/user records for one account/chain/API-network/RPC scope; they win over every other source. */
export const selectScopedMetadata = (state: UISnapshot, scopeKey: string, category: MetadataCategory) =>
  state.metadata.scoped?.[scopeKey]?.[toMetadataField(category)];

/** Whitelist seeds apply to Mainnet only and lose to legacy and scoped records. */
export const selectSeedMetadata = (state: UISnapshot, chainId: string, category: MetadataCategory) =>
  chainId === TempleChainId.Mainnet
    ? state.metadata.scoped?.[WHITELIST_METADATA_SCOPE_KEY]?.[toMetadataField(category)]
    : undefined;

const ASSET_METADATA_CATEGORIES: MetadataCategory[] = ['rwas', 'tokens', 'collectibles'];

/**
 * Non-hook asset metadata lookup with the same source precedence as `useOwnedMetadata`
 * and the same category order as `useAssetMetadata`.
 *
 * @returns `undefined` when the owner snapshot is not ready or no category holds the slug.
 */
export function getOwnedAssetMetadata(slug: string, scope: MetadataScope): AssetMetadataBase | undefined {
  let state: UISnapshot;
  try {
    state = getOwnedUISnapshot();
  } catch {
    return undefined;
  }

  const scopeKey = getMetadataScopeKey(scope);

  for (const category of ASSET_METADATA_CATEGORIES) {
    const metadata =
      selectScopedMetadata(state, scopeKey, category)?.[slug] ??
      selectLegacyMetadata(state, category)?.[slug] ??
      selectSeedMetadata(state, scope.chainId, category)?.[slug];
    if (metadata) return metadata;
  }

  return undefined;
}
