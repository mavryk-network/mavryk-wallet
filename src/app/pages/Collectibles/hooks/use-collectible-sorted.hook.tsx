import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { useAllNFTDetailsSelector } from 'app/store/nfts/selectors';
import { useTokensMetadataSelector } from 'app/store/tokens-metadata/selectors';
import { objktCurrencies } from 'lib/apis/objkt';
import { SortOptions } from 'lib/assets/use-sorted';
import { atomsToTokens } from 'lib/temple/helpers';

export function useSortededNFTsSlugs(sortOption: SortOptions | null, assetsSlugs: string[]) {
  const assetsDetails = useAllNFTDetailsSelector();
  const assetsMetadatas = useTokensMetadataSelector();

  const assetsSlugNames = useMemo(
    () =>
      assetsSlugs.map(slug => ({
        name: assetsMetadatas[slug]?.name ?? 'Unknwon token',
        slug
      })),
    [assetsSlugs, assetsMetadatas]
  );

  let sortedAssetSlugs = [...assetsSlugs];

  switch (sortOption) {
    case SortOptions.BY_NAME:
      sortedAssetSlugs = assetsSlugNames
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map(asset => asset.slug);
      break;

    case SortOptions.HIGH_TO_LOW:
    case SortOptions.LOW_TO_HIGH:
      sortedAssetSlugs = sortedAssetSlugs.sort((a, b) => {
        const nftA = assetsDetails[a]?.listing;
        const nftB = assetsDetails[b]?.listing;

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

  return [...new Set([...sortedAssetSlugs])];
}
