import memoizee from 'memoizee';

import { fetchTokensMetadata, isKnownChainId } from 'lib/apis/temple';
import { fetchTzktAccountAssets } from 'lib/apis/tzkt';
import type { TzktAccountAsset } from 'lib/apis/tzkt/types';
import { toTokenSlug } from 'lib/assets';
import { isCollectible } from 'lib/metadata/classification';
import type { FetchedMetadataRecord } from 'lib/metadata/fetch';
import {
  fetchWalletRwaAssets,
  mapWalletRwaAssetsToFetchedMetadataRecord,
  walletRwaAssetToAtomicBalance,
  walletRwaAssetToSlug
} from 'mavryk/api/rwas';

import { MetadataMap } from '../collectibles-metadata/state';

export { getAccountAssetsStoreKey } from 'lib/assets/account-assets-key';

export const isAccountAssetsStoreKeyOfSameChainIdAndDifferentAccount = (
  key: string,
  account: string,
  chainId: string
) => !key.startsWith(account) && key.endsWith(chainId);

/** The wallet RWA endpoint owns category membership, including fungible assets known to the indexer. */
export const loadAccountTokens = async (account: string, chainId: string, knownMeta: MetadataMap) => {
  const [fungibleAssets, unknownAssets, rwaAssets] = await Promise.all([
    fetchTzktAccountAssets(account, chainId, true),
    fetchTzktAccountUnknownAssets(account, chainId),
    fetchWalletRwaAssets({ walletAddress: account })
  ]);
  const rwaSlugs = new Set(rwaAssets.map(walletRwaAssetToSlug));
  const excludeRwas = (assets: TzktAccountAsset[]) =>
    assets.filter(asset => !rwaSlugs.has(tzktAssetToTokenSlug(asset)));
  const [known, unknown] = await Promise.all([
    finishTokensLoading(excludeRwas(fungibleAssets), chainId, knownMeta),
    finishTokensLoading(excludeRwas(unknownAssets), chainId, knownMeta, true)
  ]);
  return mergeLoadedAssetsData(known, unknown);
};

export const loadAccountCollectibles = (account: string, chainId: string, knownMeta: MetadataMap) =>
  Promise.all([
    // Fetching assets known to be NFTs, not checking metadata
    fetchTzktAccountAssets(account, chainId, false).then(data => {
      return finishCollectiblesLoadingWithMeta(data);
    }),
    // Fetching unknowns only, checking metadata to filter for NFTs
    fetchTzktAccountUnknownAssets(account, chainId).then(data => {
      return finishCollectiblesLoadingWithoutMeta(data, knownMeta, chainId);
    })
  ]).then(([data1, data2]) => mergeLoadedAssetsData(data1, data2));

export const loadAccountRwas = (account: string, _chainId: string, _knownMeta: MetadataMap) =>
  fetchWalletRwaAssets({ walletAddress: account }).then(finishRwasLoading);

const fetchTzktAccountUnknownAssets = memoizee(
  // Simply reducing frequency of requests per set of arguments.
  (account: string, chainId: string) => fetchTzktAccountAssets(account, chainId, null),
  { maxAge: 10_000, normalizer: ([account, chainId]) => `${account}_${chainId}`, promise: true }
);

/** Classification must not reconcile an incomplete/failed metadata batch as an empty asset list. */
async function fetchClassificationMetadata(chainId: string, slugs: string[]) {
  if (!isKnownChainId(chainId)) return null;
  const result = await fetchTokensMetadata(chainId, slugs);
  if (!Array.isArray(result) || result.length !== slugs.length) throw new Error('Incomplete asset metadata response');
  return result;
}

const finishTokensLoading = async (
  data: TzktAccountAsset[],
  chainId: string,
  knownMeta: MetadataMap,
  fungibleByMetaCheck = false
) => {
  const slugsWithoutMeta = data.reduce<string[]>((acc, curr) => {
    const slug = tzktAssetToTokenSlug(curr);
    return knownMeta.has(slug) ? acc : acc.concat(slug);
  }, []);

  const newMetadatas = await fetchClassificationMetadata(chainId, slugsWithoutMeta);

  const slugs: string[] = [];
  const balances: StringRecord = {};
  const newMeta: FetchedMetadataRecord = {};

  for (const asset of data) {
    const slug = tzktAssetToTokenSlug(asset);

    // Not optimal data pick, but we don't expect large arrays here
    const metadataOfNew = newMetadatas?.[slugsWithoutMeta.indexOf(slug)];

    if (fungibleByMetaCheck) {
      const metadata = metadataOfNew || knownMeta.get(slug);

      if (!metadata) throw new Error('Incomplete asset classification');
      if (isCollectible(metadata)) continue;
    }
    slugs.push(slug);
    balances[slug] = asset.balance;
    if (metadataOfNew) newMeta[slug] = metadataOfNew;
  }

  return { slugs, balances, newMeta };
};

// collectibles ---------------

const finishCollectiblesLoadingWithMeta = async (data: TzktAccountAsset[]) => {
  const slugs: string[] = [];
  const balances: StringRecord = {};

  for (const asset of data) {
    const slug = tzktAssetToTokenSlug(asset);

    slugs.push(slug);
    balances[slug] = asset.balance;
  }

  return { slugs, balances };
};

const finishCollectiblesLoadingWithoutMeta = async (
  data: TzktAccountAsset[],
  knownMeta: MetadataMap,
  chainId: string
) => {
  const slugsWithoutMeta = data.reduce<string[]>((acc, curr) => {
    const slug = tzktAssetToTokenSlug(curr);
    return knownMeta.has(slug) ? acc : acc.concat(slug);
  }, []);

  const newMetadatas = await fetchClassificationMetadata(chainId, slugsWithoutMeta);

  const slugs: string[] = [];
  const balances: StringRecord = {};
  const newMeta: FetchedMetadataRecord = {};

  for (const asset of data) {
    const slug = tzktAssetToTokenSlug(asset);

    // Not optimal data pick, but we don't expect large arrays here
    const metadataOfNew = newMetadatas?.[slugsWithoutMeta.indexOf(slug)];
    const metadata = metadataOfNew || knownMeta.get(slug);

    if (!metadata) throw new Error('Incomplete asset classification');
    if (!isCollectible(metadata)) continue;

    if (metadataOfNew) newMeta[slug] = metadataOfNew;

    slugs.push(slug);
    balances[slug] = asset.balance;
  }

  return { slugs, balances, newMeta };
};

// rwa ---------------
const finishRwasLoading = async (data: Awaited<ReturnType<typeof fetchWalletRwaAssets>>) => {
  const slugs: string[] = [];
  const balances: StringRecord = {};
  const newMeta: FetchedMetadataRecord = mapWalletRwaAssetsToFetchedMetadataRecord(data);

  for (const asset of data) {
    const slug = walletRwaAssetToSlug(asset);
    slugs.push(slug);
    balances[slug] = walletRwaAssetToAtomicBalance(asset);
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

const tzktAssetToTokenSlug = ({ token }: TzktAccountAsset) => toTokenSlug(token.contract.address, token.tokenId);
