import { CancelledError, useQuery } from '@tanstack/react-query';

import { fetchScamlistTokens } from 'lib/apis/temple/scamlist-tokens';
import { fetchWhitelistTokens } from 'lib/apis/temple/whitelist-tokens';
import { assetsKeys } from 'lib/query-keys';
import { useOwnedUIStatus } from 'lib/store/zustand/ui-client';
import { TempleChainId } from 'lib/temple/types';

import { beginAssetSync, syncSecurity } from './sync-security';

/** Preserve startup-only public-feed refresh. Failed requests retain the owner's last accepted cache. */
export function useSecurityQuery(chainId: string) {
  const { isReady } = useOwnedUIStatus();
  const useFeed = (category: 'scamlist' | 'whitelist', enabled: boolean) =>
    useQuery({
      queryKey: assetsKeys.security(category),
      enabled: isReady && enabled,
      staleTime: 0,
      cacheTime: 5 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      queryFn: async ({ signal }) => {
        const request = await beginAssetSync(category);
        if (signal?.aborted) throw new CancelledError({ revert: true });
        const response =
          category === 'scamlist'
            ? { kind: 'scamlist' as const, data: await fetchScamlistTokens() }
            : { kind: 'whitelist' as const, data: await fetchWhitelistTokens() };
        if (signal?.aborted) throw new CancelledError({ revert: true });
        await syncSecurity(request, response);
        return true;
      }
    });
  useFeed('scamlist', true);
  useFeed('whitelist', chainId === TempleChainId.Mainnet);
}
