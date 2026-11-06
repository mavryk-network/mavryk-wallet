import { useMemo } from 'react';

import { useDetailScope } from 'lib/asset-details/use-detail-scope';
import { useNetwork } from 'lib/temple/front';

import { MetadataScope } from './metadata-scope';

/** Includes custom RPC identity, even when two RPCs report the same chain. */
export const useMetadataScope = (): MetadataScope => {
  const { account, chainId, networkId } = useDetailScope();
  const rpcUrl = useNetwork().rpcBaseURL;
  return useMemo(() => ({ account, chainId, networkId, rpcUrl }), [account, chainId, networkId, rpcUrl]);
};
