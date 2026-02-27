import { isCollectible, isRwa, TokenMetadata } from 'lib/metadata';
import { assetsStore, AssetToPut } from 'lib/store/zustand/assets.store';
import * as Repo from 'lib/temple/repo';

export const migrateFromIndexedDB = async (metadatas: Record<string, TokenMetadata>) => {
  const allRecords = await Repo.accountTokens.toArray();

  const collectibles: AssetToPut[] = [];
  const tokens: AssetToPut[] = [];
  const rwas: AssetToPut[] = [];

  const statusMap = {
    [Repo.ITokenStatus.Enabled]: 'enabled',
    [Repo.ITokenStatus.Disabled]: 'disabled',
    [Repo.ITokenStatus.Removed]: 'removed',
    [Repo.ITokenStatus.Idle]: 'idle'
  } as const;

  for (const { tokenSlug, account, chainId, status } of allRecords) {
    const metadata = metadatas[tokenSlug];
    if (!metadata) continue;

    let assetsDestionation = tokens;
    if (isCollectible(metadata)) {
      assetsDestionation = collectibles;
    } else if (isRwa(metadata)) {
      assetsDestionation = rwas;
    }

    assetsDestionation.push({
      slug: tokenSlug,
      account,
      chainId,
      status: statusMap[status],
      // Specifying all as manually added, as this information is lost at this point.
      manual: true
    });
  }

  const store = assetsStore.getState();
  if (tokens.length) store.putTokensAsIs(tokens);
  if (collectibles.length) store.putCollectiblesAsIs(collectibles);
  if (rwas.length) store.putRwasAsIs(rwas);

  await Repo.accountTokens.clear();
};
