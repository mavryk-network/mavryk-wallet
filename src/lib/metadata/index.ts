import { useCallback, useEffect, useMemo, useRef } from 'react';

import { isString } from 'lodash';

import { METADATA_API_LOAD_CHUNK_SIZE } from 'lib/apis/temple';
import { isMavSlug } from 'lib/assets';
import {
  metadataStore,
  useAllCollectiblesMetadataSelector,
  useAllRwasMetadataSelector,
  useAllTokensMetadataSelector,
  useCollectibleMetadataSelector,
  useCollectiblesMetadataLoadingSelector,
  useRwaMetadataSelector,
  useRwasMetadataLoadingSelector,
  useTokenMetadataSelector,
  useTokensMetadataLoadingSelector
} from 'lib/store/zustand/metadata.store';
import { useNetwork } from 'lib/temple/front';
import { isTruthy } from 'lib/utils';

import { MAVEN_METADATA, FILM_METADATA } from './defaults';
import { loadTokensMetadata } from './fetch';
import { AssetMetadataBase, TokenMetadata } from './types';

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

  const merged = useMemo(() => {
    const map: Record<string, TokenMetadata> = { ...collectiblesMetadata, ...rwasMetadata, ...tokensMetadata };
    return map;
  }, [collectiblesMetadata, rwasMetadata, tokensMetadata]);

  return slugs
    .map(s => {
      if (isMavSlug(s)) return gasMetadata;
      return merged[s];
    })
    .filter(s => Boolean(s));
};

export type TokenMetadataGetter = (slug: string) => TokenMetadata | undefined;

export const useGetTokenMetadata = () => {
  const tokensMeta = useAllTokensMetadataSelector();
  const rwaMeta = useAllRwasMetadataSelector();

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

  return useCallback<TokenMetadataGetter>(slug => allMeta[slug], [allMeta]);
};

export const useGetRwaMetadata = () => {
  const allMeta = useAllRwasMetadataSelector();

  return useCallback<TokenMetadataGetter>(slug => allMeta[slug], [allMeta]);
};

export const useGetAssetMetadata = () => {
  const getTokenOrGasMetadata = useGetTokenOrGasMetadata();
  const getCollectibleMetadata = useGetCollectibleMetadata();

  return useCallback(
    (slug: string) => getTokenOrGasMetadata(slug) || getCollectibleMetadata(slug),
    [getTokenOrGasMetadata, getCollectibleMetadata]
  );
};

/**
 * @param slugsToCheck // Memoize
 */
export const useTokensMetadataPresenceCheck = (slugsToCheck?: string[]) => {
  const metadataLoading = useTokensMetadataLoadingSelector();
  const getMetadata = useGetTokenMetadata();

  useAssetsMetadataPresenceCheck('tokens', metadataLoading, getMetadata, slugsToCheck);
};

/**
 * @param slugsToCheck // Memoize
 */
export const useCollectiblesMetadataPresenceCheck = (slugsToCheck?: string[]) => {
  const metadataLoading = useCollectiblesMetadataLoadingSelector();
  const getMetadata = useGetCollectibleMetadata();

  useAssetsMetadataPresenceCheck('collectibles', metadataLoading, getMetadata, slugsToCheck);
};

/**
 * @param slugsToCheck // Memoize
 */
export const useRwasMetadataPresenceCheck = (slugsToCheck?: string[]) => {
  const metadataLoading = useRwasMetadataLoadingSelector();
  const getMetadata = useGetRwaMetadata();

  useAssetsMetadataPresenceCheck('rwas', metadataLoading, getMetadata, slugsToCheck);
};

const useAssetsMetadataPresenceCheck = (
  ofAssets: 'collectibles' | 'rwas' | 'tokens',
  metadataLoading: boolean,
  getMetadata: TokenMetadataGetter,
  slugsToCheck?: string[]
) => {
  const { rpcBaseURL: rpcUrl } = useNetwork();

  const checkedRef = useRef<string[]>([]);

  useEffect(() => {
    if (metadataLoading || !slugsToCheck?.length) return;

    const missingChunk = slugsToCheck
      .filter(
        slug =>
          !isMavSlug(slug) &&
          !isTruthy(getMetadata(slug)) &&
          // In case fetched metadata is `null` & won't save
          !checkedRef.current.includes(slug)
      )
      .slice(0, METADATA_API_LOAD_CHUNK_SIZE);

    if (missingChunk.length > 0) {
      checkedRef.current = [...checkedRef.current, ...missingChunk];

      const store = metadataStore.getState();

      if (ofAssets === 'tokens') {
        store.setTokensMetadataLoading(true);
      } else if (ofAssets === 'collectibles') {
        store.setCollectiblesMetadataLoading(true);
      } else {
        store.setRwasMetadataLoading(true);
      }

      loadTokensMetadata(rpcUrl, missingChunk).then(
        records => {
          const store = metadataStore.getState();
          if (ofAssets === 'tokens') {
            store.putTokensMetadata(records, true);
          } else if (ofAssets === 'collectibles') {
            store.putCollectiblesMetadata(records, true);
          } else {
            store.putRwasMetadata(records, true);
          }
        },
        () => {
          const store = metadataStore.getState();
          if (ofAssets === 'tokens') {
            store.setTokensMetadataLoading(false);
          } else if (ofAssets === 'collectibles') {
            store.setCollectiblesMetadataLoading(false);
          } else {
            store.setRwasMetadataLoading(false);
          }
        }
      );
    }
  }, [ofAssets, slugsToCheck, getMetadata, metadataLoading, rpcUrl]);
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
export const isCollectible = (metadata: Record<string, any>) =>
  'artifactUri' in metadata && isString(metadata.artifactUri);

// TODO update hardcoded logic to be dynamic one, at this moment api doesn't provide this info
const RWA_SYMBOLS = ['ocean', 'mars1', 'ntbm', 'queen'];

export const isRwa = (metadata: Record<string, any>) =>
  'symbol' in metadata && RWA_SYMBOLS.includes(metadata.symbol.toLowerCase());

/**
 * @deprecated // Assertion here is not safe!
 */
export const isCollectibleTokenMetadata = (metadata: AssetMetadataBase): metadata is TokenMetadata =>
  isCollectible(metadata);
