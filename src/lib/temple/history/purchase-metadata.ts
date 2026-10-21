import { isCancelledError, QueryClient } from '@tanstack/react-query';

import { requestMetadata } from 'lib/metadata/metadata-query';
import { getMetadataScopeKey, MetadataScope } from 'lib/metadata/metadata-scope';
import { getOwnedUISnapshot } from 'lib/store/zustand/ui-client';

/** Resolve purchase decimals from the captured owner scope; failed enrichment leaves amounts unavailable. */
export async function resolvePurchaseDecimals(client: QueryClient, scope: MetadataScope, slugs: string[]) {
  const read = () => {
    const scoped = getOwnedUISnapshot().metadata.scoped?.[getMetadataScopeKey(scope)];
    const result: Record<string, number> = {};
    for (const slug of slugs) {
      const metadata = scoped?.rwasMetadata[slug] ?? scoped?.tokensMetadata[slug] ?? scoped?.collectiblesMetadata[slug];
      if (metadata) result[slug] = metadata.decimals;
    }
    return result;
  };
  // RWA mapping reuses walletRwaAssetToMetadata; on-chain metadata covers non-catalog FA2 assets.
  for (const category of ['rwas', 'collectibles'] as const) {
    const current = read();
    const missing = slugs.filter(slug => current[slug] === undefined);
    if (!missing.length) return current;
    try {
      await requestMetadata(client, scope, category, missing);
    } catch (error) {
      if (isCancelledError(error)) throw error;
      console.error('Unable to resolve purchase metadata');
    }
  }
  return read();
}
