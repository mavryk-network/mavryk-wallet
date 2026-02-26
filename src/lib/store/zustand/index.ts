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
