import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';

import { useTokensMetadataSelector } from 'app/store/tokens-metadata/selectors';

export enum SortOptions {
  HIGH_TO_LOW = 'highToLow',
  LOW_TO_HIGH = 'lowToHigh',
  BY_NAME = 'byName'
}

export function useSortededAssetsSlugs(
  sortOption: SortOptions | null,
  assetsSlugs: string[],
  balances: Record<string, BigNumber>,
  topSlug = 'tez'
) {
  const tokensMetadata = useTokensMetadataSelector();

  const assetsSlugNames = useMemo(
    () =>
      assetsSlugs.map(slug => ({
        name: tokensMetadata[slug]?.name ?? 'Unknwon token',
        slug
      })),
    [assetsSlugs, tokensMetadata]
  );

  let sortedAssetSlugs = [...assetsSlugs].filter(slug => slug !== topSlug);

  switch (sortOption) {
    case SortOptions.BY_NAME:
      sortedAssetSlugs = assetsSlugNames
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map(asset => asset.slug);
      break;

    case SortOptions.HIGH_TO_LOW:
      sortedAssetSlugs = sortedAssetSlugs.sort((a, b) => {
        const tokenABalance = balances[a] ?? new BigNumber(0);
        const tokenBBalance = balances[b] ?? new BigNumber(0);

        return tokenBBalance.comparedTo(tokenABalance);
      });
      break;

    case SortOptions.LOW_TO_HIGH:
      sortedAssetSlugs = sortedAssetSlugs.sort((a, b) => {
        const tokenABalance = balances[a] ?? new BigNumber(0);
        const tokenBBalance = balances[b] ?? new BigNumber(0);

        return tokenABalance.comparedTo(tokenBBalance);
      });
      break;

    default:
      sortedAssetSlugs = [...sortedAssetSlugs];
  }

  return [...new Set([topSlug, ...sortedAssetSlugs])];
}
