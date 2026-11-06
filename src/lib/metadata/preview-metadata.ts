import { QueryClient } from '@tanstack/react-query';

import { withScopedWalletRequest } from 'lib/assets/scoped-wallet-request';
import { toTokenSlug } from 'lib/assets/utils';
import { metadataKeys } from 'lib/query-keys';

import { fetchOneTokenMetadata } from './fetch';
import { MetadataScope } from './metadata-scope';
import { normalizeMetadata } from './sync-metadata';

/** Provisional form data has no durable side effects; save remains an explicit user command. */
export function previewMetadata(client: QueryClient, scope: MetadataScope, address: string, id: string) {
  const slug = toTokenSlug(address, id);
  return client.fetchQuery({
    queryKey: [...metadataKeys.scope('preview', scope), slug],
    staleTime: 60_000,
    cacheTime: 5 * 60_000,
    retry: false,
    queryFn: ({ signal }) =>
      withScopedWalletRequest(scope, signal, async assertScope => {
        const value = await fetchOneTokenMetadata(scope.rpcUrl, address, id, scope.chainId);
        if (value) normalizeMetadata('tokens', [slug], { [slug]: value });
        await assertScope();
        return value ?? null;
      })
  });
}
