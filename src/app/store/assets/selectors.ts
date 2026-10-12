import { useOwnedUI } from 'lib/store/zustand/ui-client';

import { useSelector } from '../root-state.selector';

import { getAccountAssetsStoreKey } from './utils';

export type AssetsType = 'collectibles' | 'tokens' | 'rwas';

export const useAllTokensSelector = () => useOwnedUI(state => state.assets.tokens);

const ACCOUNT_ASSETS_EMPTY = {};

export const useAccountTokensSelector = (account: string, chainId: string) =>
  useOwnedUI(state => state.assets.tokens[getAccountAssetsStoreKey(account, chainId)] ?? ACCOUNT_ASSETS_EMPTY);

export const useAccountCollectiblesSelector = (account: string, chainId: string) =>
  useOwnedUI(state => state.assets.collectibles[getAccountAssetsStoreKey(account, chainId)] ?? ACCOUNT_ASSETS_EMPTY);

export const useAccountRwasSelector = (account: string, chainId: string) =>
  useOwnedUI(state => state.assets.rwas[getAccountAssetsStoreKey(account, chainId)] ?? ACCOUNT_ASSETS_EMPTY);

export const useAreAssetsLoading = (type: AssetsType) => useSelector(state => state.assets[type].isLoading);

const EMPTY_WHITELIST: string[] = [];

export const useMainnetTokensWhitelistSelector = () =>
  useOwnedUI(state => state.assets.mainnetWhitelist ?? EMPTY_WHITELIST);

export const useMainnetTokensScamlistSelector = () => useOwnedUI(state => state.assets.mainnetScamlist);
