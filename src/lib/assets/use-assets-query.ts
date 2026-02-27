import { useQuery } from '@tanstack/react-query';

import { fetchWhitelistTokens } from 'lib/apis/temple';
import { fetchScamlistTokens } from 'lib/apis/temple/scamlist-tokens';
import { isKnownChainId } from 'lib/apis/tzkt';
import { ASSETS_SYNC_INTERVAL } from 'lib/fixed-times';
import { assetsStore, useAreAssetsLoading } from 'lib/store/zustand/assets.store';
import { metadataStore } from 'lib/store/zustand/metadata.store';
import { useAccount, useChainId } from 'lib/temple/front';
import { TempleChainId } from 'lib/temple/types';
import { useInterval } from 'lib/ui/hooks';

import { loadAccountTokens, loadAccountCollectibles, loadAccountRwas } from './load-account-assets';

// ---- Query Keys -----------------------------------------------------------

const assetsKeys = {
  whitelist: ['assets', 'whitelist'] as const,
  scamlist: ['assets', 'scamlist'] as const,
  accountTokens: (account: string, chainId: string) => ['assets', 'accountTokens', account, chainId] as const,
  accountCollectibles: (account: string, chainId: string) =>
    ['assets', 'accountCollectibles', account, chainId] as const,
  accountRwas: (account: string, chainId: string) => ['assets', 'accountRwas', account, chainId] as const
};

// ---- Whitelist Query ------------------------------------------------------

export const useWhitelistQuery = (enabled: boolean) =>
  useQuery({
    queryKey: assetsKeys.whitelist,
    queryFn: async () => {
      assetsStore.getState().setWhitelistLoading(true);
      try {
        const tokens = await fetchWhitelistTokens();
        assetsStore.getState().loadWhitelistSuccess(tokens);

        // Bridge: feed whitelist data to the metadata store
        // (replaces tokens-metadata bridge epic)
        metadataStore.getState().addWhitelistTokensMetadata(tokens);

        return tokens;
      } catch (err) {
        assetsStore.getState().setWhitelistLoading(false);
        throw err;
      }
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false
  });

// ---- Scamlist Query -------------------------------------------------------

export const useScamlistQuery = () =>
  useQuery({
    queryKey: assetsKeys.scamlist,
    queryFn: async () => {
      assetsStore.getState().setScamlistLoading(true);
      try {
        const slugs = await fetchScamlistTokens();
        assetsStore.getState().loadScamlistSuccess(slugs);
        return slugs;
      } catch (err) {
        assetsStore.getState().setScamlistLoading(false);
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false
  });

// ---- Account Assets Loading (replaces use-assets-loading.ts) ---------------

export const useAssetsLoading = () => {
  const chainId = useChainId()!;
  const { publicKeyHash } = useAccount();

  const isMainnet = chainId === TempleChainId.Mainnet;
  useWhitelistQuery(isMainnet);

  const tokensAreLoading = useAreAssetsLoading('tokens');

  useInterval(
    () => {
      if (!tokensAreLoading && isKnownChainId(chainId)) {
        loadAccountTokens(publicKeyHash, chainId);
      }
    },
    ASSETS_SYNC_INTERVAL,
    [chainId, publicKeyHash]
  );

  const collectiblesAreLoading = useAreAssetsLoading('collectibles');
  const rwasAreLoading = useAreAssetsLoading('rwas');

  useInterval(
    () => {
      if (!collectiblesAreLoading && isKnownChainId(chainId)) {
        loadAccountCollectibles(publicKeyHash, chainId);
      }

      if (!rwasAreLoading && isKnownChainId(chainId)) {
        loadAccountRwas(publicKeyHash, chainId);
      }
    },
    ASSETS_SYNC_INTERVAL,
    [chainId, publicKeyHash]
  );
};
