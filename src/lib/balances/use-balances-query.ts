import { useQuery } from '@tanstack/react-query';

import { isKnownChainId } from 'lib/apis/tzkt';
import { useMetadataScope } from 'lib/metadata/use-metadata-scope';
import { useOwnedUIStatus } from 'lib/store/zustand/ui-client';

import { balanceQueryOptions } from './balance-query';

/** Other accounts share the same batching and readiness without requiring selection as the active account. */
export function useBalancesQuery(account: string, isEnabled = true) {
  const selected = useMetadataScope();
  const scope = { ...selected, account };
  const { isReady } = useOwnedUIStatus();
  const enabled =
    isEnabled && isReady && !!account && !!scope.rpcUrl && !!scope.networkId && isKnownChainId(scope.chainId);
  const native = useQuery({ ...balanceQueryOptions(scope, 'native'), enabled });
  const tokens = useQuery({ ...balanceQueryOptions(scope, 'tokens'), enabled });
  return {
    isLoading: native.isFetching || tokens.isFetching,
    error: native.error ?? tokens.error,
    isStoredError: !!(native.error || tokens.error)
  };
}
