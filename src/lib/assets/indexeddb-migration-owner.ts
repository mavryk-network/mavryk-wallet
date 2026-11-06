import { fetchOneTokenMetadata, isKnownChainId } from 'lib/apis/temple/metadata';
import { buildTokenMetadataFromFetched } from 'lib/metadata/utils';
import { accountTokens } from 'lib/temple/repo';

import { IndexedDBAsset, migrateIndexedDBAssets } from './indexeddb-migration';
import { fromAssetSlug } from './utils';

/** The source has a chain ID but no RPC URL. Fetch only on the matching supported metadata network. */
async function fetchMetadata({ chainId, tokenSlug }: IndexedDBAsset) {
  const [address, id] = fromAssetSlug(tokenSlug);
  if (!isKnownChainId(chainId) || !id) return undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      fetchOneTokenMetadata(chainId, address, id),
      new Promise<undefined>(resolve => {
        timer = setTimeout(() => resolve(undefined), 10_000);
      })
    ]);
    return raw ? buildTokenMetadataFromFetched(raw, address, id) : undefined;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Production wiring is loaded only by the background owner, never by foreground migration callers. */
export const runIndexedDBAssetsMigration = (
  stores: Pick<Parameters<typeof migrateIndexedDBAssets>[0], 'ui' | 'metadata' | 'assets'>
) => migrateIndexedDBAssets({ ...stores, table: accountTokens, fetchMetadata });
