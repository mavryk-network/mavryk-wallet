import memoizee from 'memoizee';

import { fetchMvktAccountAssets } from 'lib/apis/mvkt';
import { fetchMvktAccountRWAAssets } from 'lib/apis/mvkt/api';
import type { MvktAccountAsset } from 'lib/apis/mvkt/types';
import { fetchTokensMetadata, isKnownChainId } from 'lib/apis/temple';
import { toTokenSlug } from 'lib/assets';
import { isCollectible, isRwa } from 'lib/metadata';
import type { FetchedMetadataRecord } from 'lib/metadata/fetch';
import type { MetadataMap } from 'lib/metadata/types';

export const loadAccountTokens = (account: string, chainId: string, knownMeta: MetadataMap) =>
  Promise.all([
    // Fetching assets known to be FTs, not checking metadata
    fetchMvktAccountAssets(account, chainId, true).then(data => finishTokensLoading(data, chainId, knownMeta)),
    // Fetching unknowns only, checking metadata to filter for FTs
    fetchMvktAccountUnknownAssets(account, chainId).then(data => finishTokensLoading(data, chainId, knownMeta, true))
  ]).then(
    ([data1, data2]) => {
      return mergeLoadedAssetsData(data1, data2);
    },
    error => {
      console.error(error);
      throw error;
    }
  );

export const loadAccountCollectibles = (account: string, chainId: string, knownMeta: MetadataMap) =>
  Promise.all([
    // Fetching assets known to be NFTs, not checking metadata
    fetchMvktAccountAssets(account, chainId, false).then(data => {
      return finishCollectiblesLoadingWithMeta(data);
    }),
    // Fetching unknowns only, checking metadata to filter for NFTs
    fetchMvktAccountUnknownAssets(account, chainId).then(data => {
      return finishCollectiblesLoadingWithoutMeta(data, knownMeta, chainId);
    })
  ]).then(
    ([data1, data2]) => {
      return mergeLoadedAssetsData(data1, data2);
    },
    error => {
      console.error(error);
      throw error;
    }
  );

export const loadAccountRwas = (account: string, chainId: string, knownMeta: MetadataMap) =>
  Promise.all([
    // Fetching unknowns only, checking metadata to filter for RWAs
    fetchMvktAccountRWAAssets(account, chainId, true).then(data => {
      return finishRwasLoadingWithoutMeta(data, chainId, knownMeta);
    })
  ]).then(
    ([data]) => ({
      slugs: data.slugs,
      balances: data.balances,
      newMeta: data.newMeta
    }),
    error => {
      console.error(error);
      throw error;
    }
  );

const fetchMvktAccountUnknownAssets = memoizee(
  // Simply reducing frequency of requests per set of arguments.
  (account: string, chainId: string) => fetchMvktAccountAssets(account, chainId, null),
  { maxAge: 10_000, normalizer: ([account, chainId]) => `${account}_${chainId}`, promise: true }
);

const finishTokensLoading = async (
  data: MvktAccountAsset[],
  chainId: string,
  knownMeta: MetadataMap,
  fungibleByMetaCheck = false
) => {
  const slugsWithoutMeta = data.reduce<string[]>((acc, curr) => {
    const slug = mvktAssetToTokenSlug(curr);
    return knownMeta.has(slug) ? acc : acc.concat(slug);
  }, []);

  const newMetadatas = isKnownChainId(chainId)
    ? await fetchTokensMetadata(chainId, slugsWithoutMeta).catch(err => {
        console.error(err);
      })
    : null;

  const slugs: string[] = [];
  const balances: StringRecord = {};
  const newMeta: FetchedMetadataRecord = {};

  for (const asset of data) {
    const slug = mvktAssetToTokenSlug(asset);

    // Not optimal data pick, but we don't expect large arrays here
    const metadataOfNew = newMetadatas?.[slugsWithoutMeta.indexOf(slug)];

    if (fungibleByMetaCheck) {
      const metadata = metadataOfNew || knownMeta.get(slug);

      if (!metadata || isCollectible(metadata) || isRwa(metadata)) continue;
    }
    slugs.push(slug);
    balances[slug] = asset.balance;
    if (metadataOfNew) newMeta[slug] = metadataOfNew;
  }

  return { slugs, balances, newMeta };
};

// collectibles ---------------

const finishCollectiblesLoadingWithMeta = async (data: MvktAccountAsset[]) => {
  const slugs: string[] = [];
  const balances: StringRecord = {};

  for (const asset of data) {
    const slug = mvktAssetToTokenSlug(asset);

    slugs.push(slug);
    balances[slug] = asset.balance;
  }

  return { slugs, balances };
};

const finishCollectiblesLoadingWithoutMeta = async (
  data: MvktAccountAsset[],
  knownMeta: MetadataMap,
  chainId: string
) => {
  const slugsWithoutMeta = data.reduce<string[]>((acc, curr) => {
    const slug = mvktAssetToTokenSlug(curr);
    return knownMeta.has(slug) ? acc : acc.concat(slug);
  }, []);

  const newMetadatas = isKnownChainId(chainId)
    ? await fetchTokensMetadata(chainId, slugsWithoutMeta).catch(err => {
        console.error(err);
      })
    : null;

  const slugs: string[] = [];
  const balances: StringRecord = {};
  const newMeta: FetchedMetadataRecord = {};

  for (const asset of data) {
    const slug = mvktAssetToTokenSlug(asset);

    // Not optimal data pick, but we don't expect large arrays here
    const metadataOfNew = newMetadatas?.[slugsWithoutMeta.indexOf(slug)];
    const metadata = metadataOfNew || knownMeta.get(slug);

    if (!metadata || !isCollectible(metadata)) continue;

    if (metadataOfNew) newMeta[slug] = metadataOfNew;

    slugs.push(slug);
    balances[slug] = asset.balance;
  }

  return { slugs, balances, newMeta };
};

// rwa ---------------
const finishRwasLoadingWithoutMeta = async (data: MvktAccountAsset[], chainId: string, knownMeta: MetadataMap) => {
  const slugs: string[] = [];
  const balances: StringRecord = {};
  const newMeta: FetchedMetadataRecord = {};

  const slugsWithoutMeta = data.reduce<string[]>((acc, curr) => {
    const slug = mvktAssetToTokenSlug(curr);
    return knownMeta.has(slug) ? acc : acc.concat(slug);
  }, []);

  const newMetadatas = isKnownChainId(chainId)
    ? await fetchTokensMetadata(chainId, slugsWithoutMeta).catch(err => {
        console.error(err);
      })
    : null;

  for (const asset of data) {
    const slug = mvktAssetToTokenSlug(asset);

    // Not optimal data pick, but we don't expect large arrays here
    const metadataOfNew = asset.token.metadata || newMetadatas?.[slugsWithoutMeta.indexOf(slug)];

    const metadata = metadataOfNew || knownMeta.get(slug);

    if (!metadata || !isRwa(metadata)) continue;

    if (metadataOfNew) newMeta[slug] = metadataOfNew as any;

    slugs.push(slug);
    balances[slug] = asset.balance;
  }

  return { slugs, balances, newMeta };
};

interface LoadedAssetsData {
  slugs: string[];
  balances: StringRecord;
  newMeta?: FetchedMetadataRecord;
}

const mergeLoadedAssetsData = (data1: LoadedAssetsData, data2: LoadedAssetsData) => ({
  slugs: data1.slugs.concat(data2.slugs),
  balances: { ...data1.balances, ...data2.balances },
  newMeta: { ...data1.newMeta, ...data2.newMeta }
});

const mvktAssetToTokenSlug = ({ token }: MvktAccountAsset) => toTokenSlug(token.contract.address, token.tokenId);
