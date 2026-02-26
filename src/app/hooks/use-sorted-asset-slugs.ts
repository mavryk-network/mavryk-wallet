import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { useAllTokensMetadataSelector } from 'lib/store/zustand/metadata.store';
import { objktCurrencies } from 'lib/apis/objkt';
import { SortOptions } from 'lib/assets/use-sorted';
import { atomsToTokens } from 'lib/temple/helpers';

interface AssetListing {
  floorPrice: number;
  currencyId: number;
}

/**
 * Extracts the listing from an asset details object, if present.
 * Handles cases where the details type may not have a `listing` property (e.g. RwaDetails).
 */
const extractListing = (details: unknown): AssetListing | null | undefined => {
  if (details && typeof details === 'object' && 'listing' in details) {
    return (details as { listing: AssetListing | null }).listing;
  }
  return undefined;
};

/**
 * Shared hook for sorting collectible/RWA asset slugs by name or floor price.
 * Replaces the duplicate `useSortededCollectiblesSlugs` and `useSortededRwasSlugs`.
 *
 * @param sortOption - Current sort option (HIGH_TO_LOW, LOW_TO_HIGH, BY_NAME)
 * @param assetsSlugs - Array of asset slugs to sort
 * @param assetsDetails - Record mapping slug to asset details (may have `listing` field for price sorting)
 */
export function useSortedAssetSlugs(
  sortOption: SortOptions | null,
  assetsSlugs: string[],
  assetsDetails: Record<string, unknown>
) {
  const assetsMetadatas = useAllTokensMetadataSelector();

  const assetsSlugNames = useMemo(
    () =>
      assetsSlugs.map(slug => ({
        name: assetsMetadatas[slug]?.name ?? 'Unknown token',
        slug
      })),
    [assetsSlugs, assetsMetadatas]
  );

  let sortedAssetSlugs = useMemo(() => [...assetsSlugs], [assetsSlugs]);

  switch (sortOption) {
    case SortOptions.BY_NAME:
      sortedAssetSlugs = assetsSlugNames
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map(asset => asset.slug);
      break;

    case SortOptions.HIGH_TO_LOW:
    case SortOptions.LOW_TO_HIGH:
      sortedAssetSlugs = sortedAssetSlugs.sort((a, b) => {
        const nftA = extractListing(assetsDetails[a]);
        const nftB = extractListing(assetsDetails[b]);

        const floorA = nftA
          ? atomsToTokens(nftA.floorPrice, objktCurrencies[nftA?.currencyId].decimals)
          : new BigNumber(0);
        const floorB = nftB
          ? atomsToTokens(nftB.floorPrice, objktCurrencies[nftB?.currencyId].decimals)
          : new BigNumber(0);

        if (sortOption === SortOptions.HIGH_TO_LOW) {
          return floorB.comparedTo(floorA);
        }

        return floorA.comparedTo(floorB);
      });
      break;

    default:
      sortedAssetSlugs = [...sortedAssetSlugs];
  }

  const memoizedSortedSlugs = useMemo(() => [...new Set([...sortedAssetSlugs])], [sortedAssetSlugs]);

  return memoizedSortedSlugs;
}
