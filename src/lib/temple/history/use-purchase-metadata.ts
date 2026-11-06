import { useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { useMetadataScope } from 'lib/metadata/use-metadata-scope';

import { resolvePurchaseDecimals } from './purchase-metadata';

/** Capture account, chain, API network and RPC before history enrichment starts. */
export function usePurchaseMetadata(accountOverride?: string) {
  const client = useQueryClient();
  const { account, chainId, networkId, rpcUrl } = useMetadataScope();
  const address = accountOverride ?? account;
  return useCallback(
    (slugs: string[]) => resolvePurchaseDecimals(client, { account: address, chainId, networkId, rpcUrl }, slugs),
    [client, address, chainId, networkId, rpcUrl]
  );
}
