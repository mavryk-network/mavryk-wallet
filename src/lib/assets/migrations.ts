import { dispatch } from 'app/store';
import {
  AssetToPut,
  putTokensAsIsAction,
  putCollectiblesAsIsAction,
  putRwasAsIsAction
} from 'app/store/assets/actions';
import { isCollectible, isRwa, TokenMetadata } from 'lib/metadata';
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

    // HERE
    const assetsDestionation = isCollectible(metadata) ? collectibles : isRwa(metadata) ? rwas : tokens;

    assetsDestionation.push({
      slug: tokenSlug,
      account,
      chainId,
      status: statusMap[status],
      // Specifying all as manually added, as this information is lost at this point.
      manual: true
    });
  }

  if (tokens.length) dispatch(putTokensAsIsAction(tokens));
  if (collectibles.length) dispatch(putCollectiblesAsIsAction(collectibles));
  if (rwas.length) dispatch(putRwasAsIsAction(rwas));

  await Repo.accountTokens.clear();
};
