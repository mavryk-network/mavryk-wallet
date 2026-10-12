import { getAccountAssetsStoreKey } from 'lib/assets/account-assets-key';
import { useAssetsFetching } from 'lib/assets/use-assets-query';
import { useOwnedUI } from 'lib/store/zustand/ui-client';

export type AssetsType = 'collectibles' | 'tokens' | 'rwas';

export const useAllTokensSelector = () => useOwnedUI(state => state.assets.tokens);

const ACCOUNT_ASSETS_EMPTY = {};

export const useAccountTokensSelector = (account: string, chainId: string) =>
  useOwnedUI(state => state.assets.tokens[getAccountAssetsStoreKey(account, chainId)] ?? ACCOUNT_ASSETS_EMPTY);

export const useAccountCollectiblesSelector = (account: string, chainId: string) =>
  useOwnedUI(state => state.assets.collectibles[getAccountAssetsStoreKey(account, chainId)] ?? ACCOUNT_ASSETS_EMPTY);

export const useAccountRwasSelector = (account: string, chainId: string) =>
  useOwnedUI(state => state.assets.rwas[getAccountAssetsStoreKey(account, chainId)] ?? ACCOUNT_ASSETS_EMPTY);

export const useAreAssetsLoading = (type: AssetsType) => useAssetsFetching(type);

const EMPTY_WHITELIST: string[] = [];

export const useMainnetTokensWhitelistSelector = () =>
  useOwnedUI(state => state.assets.mainnetWhitelist ?? EMPTY_WHITELIST);

export const useMainnetTokensScamlistSelector = () => useOwnedUI(state => state.assets.mainnetScamlist);
