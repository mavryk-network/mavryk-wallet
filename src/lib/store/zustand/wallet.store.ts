import { createStore, useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { subscribeWithSelector } from 'zustand/middleware';

import type { TempleAccount, TempleNetwork, TempleSettings, TempleConfirmationPayload, WalletSpecs } from 'lib/temple/types';
import { TempleStatus } from 'lib/temple/types';

/**
 * Core wallet state store (Zustand).
 *
 * This mirrors the TempleState from the Effector background store,
 * as well as the confirmation state from the TempleClientProvider.
 *
 * Phase 5a: Created alongside existing Constate/SWR/Effector — no consumers migrated yet.
 * Phase 5b: Components will gradually switch from useTempleClient() to these selectors.
 */

interface Confirmation {
  id: string;
  payload: TempleConfirmationPayload;
  error?: unknown;
}

export interface WalletState {
  // Hydration flag — true once initial state has been fetched from background
  hydrated: boolean;

  // Core wallet state (from Effector frontStore via Intercom)
  status: TempleStatus;
  accounts: TempleAccount[];
  networks: TempleNetwork[];
  settings: TempleSettings | null;

  // Confirmation state (from Intercom subscription)
  confirmation: Confirmation | null;
  confirmationId: string | null;

  // Derived booleans
  idle: boolean;
  locked: boolean;
  ready: boolean;

  // Wallet specs (mirrored from browser.storage.local via intercom-sync)
  walletsSpecs: StringRecord<WalletSpecs>;
}

interface WalletActions {
  /** Sync full state from background (called on StateUpdated notification) */
  syncState: (state: {
    status: TempleStatus;
    accounts: TempleAccount[];
    networks: TempleNetwork[];
    settings: TempleSettings | null;
  }) => void;

  /** Set pending confirmation */
  setConfirmation: (confirmation: Confirmation) => void;

  /** Clear confirmation */
  resetConfirmation: () => void;

  /** Track the confirmation ID for matching incoming notifications */
  setConfirmationId: (id: string) => void;

  /** Sync walletsSpecs from browser.storage.local */
  setWalletsSpecs: (specs: StringRecord<WalletSpecs>) => void;
}

export type WalletStore = WalletState & WalletActions;

export const walletStore = createStore<WalletStore>()(
  subscribeWithSelector(set => ({
    // Initial state
    hydrated: false,
    status: TempleStatus.Idle,
    accounts: [],
    networks: [],
    settings: null,
    confirmation: null,
    confirmationId: null,
    idle: true,
    locked: false,
    ready: false,
    walletsSpecs: {},

    // Actions
    syncState: ({ status, accounts, networks, settings }) =>
      set({
        hydrated: true,
        status,
        accounts,
        networks,
        settings,
        idle: status === TempleStatus.Idle,
        locked: status === TempleStatus.Locked,
        ready: status === TempleStatus.Ready
      }),

    setConfirmation: confirmation => set({ confirmation }),

    resetConfirmation: () => set({ confirmation: null, confirmationId: null }),

    setConfirmationId: id => set({ confirmationId: id }),

    setWalletsSpecs: specs => set({ walletsSpecs: specs })
  }))
);

// Typed selector hooks for React components (Phase 5b will use these)
export const useWalletStore = <T>(selector: (state: WalletStore) => T): T => useStore(walletStore, selector);

// Convenience selectors
export const useWalletStatus = () => useWalletStore(s => s.status);
export const useWalletAccounts = () => useWalletStore(s => s.accounts);
export const useWalletNetworks = () => useWalletStore(s => s.networks);
export const useWalletSettings = () => useWalletStore(s => s.settings);
export const useWalletReady = () => useWalletStore(s => s.ready);
export const useWalletLocked = () => useWalletStore(s => s.locked);
export const useWalletConfirmation = () => useWalletStore(s => s.confirmation);
export const useWalletHydrated = () => useWalletStore(s => s.hydrated);

// Phase 1 selectors
export const useWalletIdle = () => useWalletStore(s => s.idle);

export const useWalletsSpecs = () => useWalletStore(s => s.walletsSpecs);

export const useCustomNetworks = () => useWalletStore(s => s.settings?.customNetworks ?? []);

export const useAllNetworks = () =>
  useWalletStore(useShallow(s => [...s.networks, ...(s.settings?.customNetworks ?? [])]));

export const useWalletState = () =>
  useWalletStore(
    useShallow(s => ({
      status: s.status,
      accounts: s.accounts,
      networks: s.networks,
      settings: s.settings
    }))
  );

/**
 * Suspense-compatible hook. Throws a promise until the wallet store is hydrated
 * with initial state from the background service worker.
 *
 * Usage: call at the top of a Suspense boundary.
 */
let hydrationPromise: Promise<void> | null = null;

export function useWalletSuspense(): void {
  const hydrated = useWalletStore(s => s.hydrated);
  if (!hydrated) {
    if (!hydrationPromise) {
      hydrationPromise = new Promise<void>(resolve => {
        const unsub = walletStore.subscribe(
          s => s.hydrated,
          isHydrated => {
            if (isHydrated) {
              unsub();
              hydrationPromise = null;
              resolve();
            }
          }
        );
      });
    }
    throw hydrationPromise;
  }
}
