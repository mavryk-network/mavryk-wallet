import { useCallback, useEffect } from 'react';

import { isCancelledError, useIsFetching, useQueryClient } from '@tanstack/react-query';

import { metadataKeys } from 'lib/query-keys';
import { useOwnedUIStatus } from 'lib/store/zustand/ui-client';

import { requestMetadata } from './metadata-query';
import { MetadataCategory } from './metadata-scope';
import { useMetadataScope } from './use-metadata-scope';

/** One shared imperative and mounted request path; metadata remains owner-read. */
export function useRequestMetadata(category: MetadataCategory) {
  const client = useQueryClient();
  const { account, chainId, networkId, rpcUrl } = useMetadataScope();
  return useCallback(
    (slugs: readonly string[], signal?: AbortSignal) =>
      requestMetadata(client, { account, chainId, networkId, rpcUrl }, category, slugs, 'put', signal),
    [client, account, chainId, networkId, rpcUrl, category]
  );
}

/** Presence checks retry on remount/input change; confirmed misses expire or can be explicitly invalidated. */
export function useMetadataQuery(category: MetadataCategory, slugs: readonly string[]) {
  const request = useRequestMetadata(category);
  const { isReady } = useOwnedUIStatus();
  const scope = useMetadataScope();
  const client = useQueryClient();
  const key = JSON.stringify(metadataKeys.scope(category, scope));
  const slugsKey = JSON.stringify([...new Set(slugs)].sort());
  const isEnabled = isReady && !!scope.account && !!scope.chainId && !!scope.networkId && !!scope.rpcUrl;
  // Register committed inputs; cleanup discards removed consumers, while shared consumers retain their request.
  useEffect(() => {
    if (!isEnabled) return;
    const controller = new AbortController();
    const run = () =>
      void request(JSON.parse(slugsKey), controller.signal).catch(error => {
        if (!isCancelledError(error)) console.error('Unable to synchronize metadata');
      });
    run();
    const unsubscribe = client.getQueryCache().subscribe(event => {
      if (
        event?.type === 'updated' &&
        event.action.type === 'invalidate' &&
        JSON.stringify(event.query.queryKey.slice(0, 6)) === key
      )
        run();
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [client, isEnabled, request, key, slugsKey]);
}

export function useMetadataFetching(category: MetadataCategory) {
  return useIsFetching({ queryKey: metadataKeys.scope(category, useMetadataScope()) }) > 0;
}
