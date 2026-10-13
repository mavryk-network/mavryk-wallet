import { useCallback, useMemo } from 'react';

import {
  useAllCollectiblesMetadataSelector,
  useCollectibleMetadataSelector
} from 'app/store/collectibles-metadata/selectors';
import { useAllRwasMetadataSelector, useRwaMetadataSelector } from 'app/store/rwas-metadata/selectors';
import { useTokenMetadataSelector, useAllTokensMetadataSelector } from 'app/store/tokens-metadata/selectors';
import { isMavSlug } from 'lib/assets';
import { useNetwork } from 'lib/temple/front';

import { isCollectible, isRwa } from './classification';
import { MAVEN_METADATA, FILM_METADATA } from './defaults';
import { AssetMetadataBase, TokenMetadata } from './types';
import { useMetadataQuery } from './use-metadata-query';
import { mapToRecord } from './utils';
export { isCollectible, isRwa } from './classification';

export type { AssetMetadataBase, TokenMetadata } from './types';
export { MAVEN_METADATA, EMPTY_BASE_METADATA } from './defaults';

export const useGasTokenMetadata = () => {
  const network = useNetwork();

  return network.type === 'dcp' ? FILM_METADATA : MAVEN_METADATA;
};

export const useAssetMetadata = (slug: string): AssetMetadataBase | undefined => {
  const tokenMetadata = useTokenMetadataSelector(slug);
  const collectibleMetadata = useCollectibleMetadataSelector(slug);
  const rwaMetadata = useRwaMetadataSelector(slug);
  const gasMetadata = useGasTokenMetadata();

  return (
    (isMavSlug(slug) ? gasMetadata : tokenMetadata) ||
    (rwaMetadata && isRwa(rwaMetadata) ? rwaMetadata : collectibleMetadata)
  );
};

export const useMultipleAssetsMetadata = (slugs: string[]): AssetMetadataBase[] | undefined => {
  const tokensMetadata = useAllTokensMetadataSelector();
  const collectiblesMetadata = useAllCollectiblesMetadataSelector();
  const rwasMetadata = useAllRwasMetadataSelector();
  const gasMetadata = useGasTokenMetadata();

  const metadata = new Map([...collectiblesMetadata, ...rwasMetadata]);

  for (const [key, value] of Object.entries(tokensMetadata)) {
    metadata.set(key, value);
  }

  /// @ts-expect-error
  return slugs
    .map(s => {
      if (isMavSlug(s)) return gasMetadata;
      return metadata.get(s);
    })
    .filter(s => Boolean(s));
};

export type TokenMetadataGetter = (slug: string) => TokenMetadata | undefined;

export const useGetTokenMetadata = () => {
  const tokensMeta = useAllTokensMetadataSelector();
  const rwaMetaMap = useAllRwasMetadataSelector();

  const rwaMeta = useMemo(() => mapToRecord(rwaMetaMap), [rwaMetaMap]);

  const allMeta: Record<string, TokenMetadata> = useMemo(() => ({ ...tokensMeta, ...rwaMeta }), [rwaMeta, tokensMeta]);

  return useCallback<TokenMetadataGetter>(slug => allMeta[slug], [allMeta]);
};

export const useGetTokenOrGasMetadata = () => {
  const getTokenMetadata = useGetTokenMetadata();
  const gasMetadata = useGasTokenMetadata();

  return useCallback(
    (slug: string): AssetMetadataBase | undefined => (isMavSlug(slug) ? gasMetadata : getTokenMetadata(slug)),
    [getTokenMetadata, gasMetadata]
  );
};

export const useGetCollectibleMetadata = () => {
  const allMeta = useAllCollectiblesMetadataSelector();

  return useCallback<TokenMetadataGetter>(slug => allMeta.get(slug), [allMeta]);
};

export const useGetRwaMetadata = () => {
  const allMeta = useAllRwasMetadataSelector();

  return useCallback<TokenMetadataGetter>(slug => allMeta.get(slug), [allMeta]);
};

export const useGetAssetMetadata = () => {
  const getTokenOrGasMetadata = useGetTokenOrGasMetadata();
  const getCollectibleMetadata = useGetCollectibleMetadata();

  return useCallback(
    (slug: string) => getTokenOrGasMetadata(slug) || getCollectibleMetadata(slug),
    [getTokenOrGasMetadata, getCollectibleMetadata]
  );
};

/** Missing values register with the shared Query batch; owner snapshots remain the only metadata source. */
export const useTokensMetadataPresenceCheck = (slugs: string[] = []) => {
  const getMetadata = useGetTokenMetadata();
  useMetadataQuery(
    'tokens',
    slugs.filter(slug => !isMavSlug(slug) && !getMetadata(slug))
  );
};

export const useCollectiblesMetadataPresenceCheck = (slugs: string[] = []) => {
  const getMetadata = useGetCollectibleMetadata();
  useMetadataQuery(
    'collectibles',
    slugs.filter(slug => !isMavSlug(slug) && !getMetadata(slug))
  );
};

export const useRwasMetadataPresenceCheck = (slugs: string[] = []) => {
  const getMetadata = useGetRwaMetadata();
  useMetadataQuery(
    'rwas',
    slugs.filter(slug => !isMavSlug(slug) && !getMetadata(slug))
  );
};

export function getAssetSymbol(metadata: AssetMetadataBase | nullish, short = false) {
  if (!metadata) return '???';
  if (!short) return metadata.symbol;
  return metadata.symbol === 'mav' ? 'ꝳ' : metadata.symbol.substring(0, 5);
}

export function getAssetName(metadata: AssetMetadataBase | nullish) {
  return metadata ? metadata.name : 'Unknown Token';
}

/** Empty string for `artifactUri` counts */
/**
 * @deprecated // Assertion here is not safe!
 */
export const isCollectibleTokenMetadata = (metadata: AssetMetadataBase): metadata is TokenMetadata =>
  isCollectible(metadata);
