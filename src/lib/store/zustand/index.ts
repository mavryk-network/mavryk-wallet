// Zustand stores
export { walletStore, useWalletStore } from './wallet.store';
export type { WalletState, WalletStore } from './wallet.store';
export {
  useWalletStatus,
  useWalletAccounts,
  useWalletNetworks,
  useWalletSettings,
  useWalletReady,
  useWalletLocked,
  useWalletConfirmation,
  useWalletHydrated,
  useWalletSuspense
} from './wallet.store';

// TanStack Query
export { queryClient } from './query-client';
export { QueryProvider } from './QueryProvider';

// Intercom sync bridge
export { startIntercomSync } from './intercom-sync';

// Persist storage adapter
export { browserStorage } from './persist-storage';

// Assets store
export { assetsStore } from './assets.store';
export type {
  AssetsState,
  AssetsStore,
  StoredAssetStatus,
  AssetsType,
  AccountAssetForStore,
  AssetToPut
} from './assets.store';
export {
  useAssetsStore,
  useAllTokensSelector,
  useAccountTokensSelector,
  useAccountCollectiblesSelector,
  useAccountRwasSelector,
  useAreAssetsLoading,
  useMainnetTokensWhitelistSelector,
  useMainnetTokensScamlistSelector,
  getAccountAssetsStoreKey,
  isAccountAssetsStoreKeyOfSameChainIdAndDifferentAccount
} from './assets.store';

// Balances store
export { balancesStore } from './balances.store';
export type { BalancesState, BalancesStore } from './balances.store';
export {
  useAllBalancesSelector,
  useAllAccountBalancesSelector,
  useBalanceSelector,
  useBalancesLoadingSelector,
  useBalancesErrorSelector,
  getKeyForBalancesRecord
} from './balances.store';
