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
  balances: Record<string, BigNumber>
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

  switch (sortOption) {
    case SortOptions.BY_NAME:
      return assetsSlugNames
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map(asset => asset.slug);

    case SortOptions.HIGH_TO_LOW:
      return assetsSlugs.sort((a, b) => {
        const tokenABalance = balances[a] ?? new BigNumber(0);
        const tokenBBalance = balances[b] ?? new BigNumber(0);

        return tokenBBalance.comparedTo(tokenABalance);
      });

    case SortOptions.LOW_TO_HIGH:
      return assetsSlugs.sort((a, b) => {
        const tokenABalance = balances[a] ?? new BigNumber(0);
        const tokenBBalance = balances[b] ?? new BigNumber(0);

        return tokenABalance.comparedTo(tokenBBalance);
      });

    default:
      return assetsSlugs;
  }
}
