import { CancelledError } from '@tanstack/react-query';
import { z } from 'zod';

import type { AssetsType } from 'app/store/assets/selectors';
import { loadAccountCollectibles, loadAccountRwas, loadAccountTokens } from 'app/store/assets/utils';
import { fixBalances } from 'app/store/balances/utils';
import { isKnownChainId } from 'lib/apis/tzkt';
import { DetailScope } from 'lib/asset-details/details.types';
import { getMetadataScopeKey } from 'lib/metadata/metadata-scope';
import { normalizeMetadata } from 'lib/metadata/sync-metadata';
import { getOwnedUISnapshot } from 'lib/store/zustand/ui-client';
import { parseData, SAFE_KEY_SCHEMA } from 'lib/store/zustand/validation';

import { getAccountAssetsSyncKey } from './account-assets-sync-key';
import { withScopedWalletRequest } from './scoped-wallet-request';
import { acknowledgeAssetSync, beginAssetSync } from './sync-security';

const loadedSchema = z.object({ slugs: z.array(z.unknown()), balances: z.record(z.unknown()) });
const BALANCE_SCHEMA = z.string().regex(/^\d+(\.\d+)?$/);

/**
 * Keep the tokens whose slug and balance validate. Anyone can send a token with an oversized id, so one invalid item is
 * skipped instead of failing the account's whole asset list; a valid slug without a balance is still a transport error.
 */
export function pickValidAssets(response: unknown) {
  const loaded = parseData(loadedSchema, response);
  const balances: Record<string, string> = {};
  for (const [slug, balance] of Object.entries(loaded.balances)) {
    const parsed = BALANCE_SCHEMA.safeParse(balance);
    if (SAFE_KEY_SCHEMA.safeParse(slug).success && parsed.success) balances[slug] = parsed.data;
  }
  const slugs: string[] = [];
  for (const slug of loaded.slugs) {
    if (typeof slug !== 'string' || !SAFE_KEY_SCHEMA.safeParse(slug).success) continue;
    if (!Object.prototype.hasOwnProperty.call(balances, slug)) {
      // An invalid balance for a valid slug is skipped with it; a missing balance is incomplete transport.
      if (Object.prototype.hasOwnProperty.call(loaded.balances, slug)) continue;
      throw new Error('Incomplete asset balances');
    }
    slugs.push(slug);
  }
  return { slugs, balances };
}

/** One publication path for asset records and their existing coupled metadata/balance effects. */
export async function syncAccountAssets(
  request: Awaited<ReturnType<typeof beginAssetSync>>,
  scope: DetailScope & { rpcUrl: string },
  category: AssetsType,
  response: Awaited<ReturnType<typeof loadAccountTokens>>,
  assertScope: () => Promise<void>
) {
  const { chainId } = scope;
  if (!isKnownChainId(chainId)) throw new Error('Unsupported asset chain');
  const { slugs, balances } = pickValidAssets(response);
  const metadata = normalizeMetadata(category, Object.keys(response.newMeta), response.newMeta);
  await assertScope();
  await acknowledgeAssetSync({
    kind: 'assets-sync',
    ...request,
    category,
    value: { account: scope.account, chainId: scope.chainId, slugs },
    metadata,
    balances: fixBalances(balances),
    scopeKey: getMetadataScopeKey(scope)
  });
  await assertScope();
}

/** Capture transport inputs and latest classification metadata; Query stores a receipt, never UI records. */
export async function loadAccountAssets(
  scope: DetailScope & { rpcUrl: string },
  category: AssetsType,
  signal?: AbortSignal
) {
  return withScopedWalletRequest(scope, signal, async assertScope => {
    const request = await beginAssetSync(getAccountAssetsSyncKey(category, scope.account, scope.chainId));
    if (signal?.aborted) throw new CancelledError({ revert: true });
    const metadata = getOwnedUISnapshot().metadata;
    const scoped = scope.rpcUrl
      ? metadata.scoped?.[getMetadataScopeKey({ ...scope, rpcUrl: scope.rpcUrl })]
      : undefined;
    const known = new Map(
      Object.entries({
        ...metadata.tokensMetadata,
        ...scoped?.tokensMetadata,
        ...(category === 'rwas' ? metadata.rwasMetadata : metadata.collectiblesMetadata),
        ...(category === 'rwas' ? scoped?.rwasMetadata : scoped?.collectiblesMetadata)
      })
    );
    const load = { tokens: loadAccountTokens, collectibles: loadAccountCollectibles, rwas: loadAccountRwas }[category];
    const response = await load(scope.account, scope.chainId, known);
    await syncAccountAssets(request, scope, category, response, assertScope);
    return true;
  });
}
