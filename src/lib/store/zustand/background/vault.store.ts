import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';

import { NETWORKS } from 'lib/temple/networks';
import type { TempleAccount, TempleNetwork, TempleSettings, TempleState } from 'lib/temple/types';
import { TempleStatus } from 'lib/temple/types';

/**
 * Background service worker state store (vanilla Zustand — no React dependency).
 *
 * This is the Zustand equivalent of the Effector store in `lib/temple/back/store.ts`.
 * It holds the vault reference, wallet status, accounts, networks, and settings.
 *
 * Phase 5a: Created alongside Effector — both stores are kept in sync.
 * Phase 5d: Effector will be removed and this becomes the sole background store.
 *
 * SECURITY NOTE: The Vault instance is held in memory only while the wallet is unlocked.
 * On lock, ALL state is reset from scratch (not merged) to prevent data leaks.
 */

// Vault type is opaque here — we reference it via the back/ module to avoid circular deps
type Vault = unknown;

export interface BackgroundState {
  inited: boolean;
  vault: Vault | null;
  status: TempleStatus;
  accounts: TempleAccount[];
  networks: TempleNetwork[];
  settings: TempleSettings | null;
}

interface UnlockedState extends BackgroundState {
  vault: NonNullable<Vault>;
}

interface BackgroundActions {
  init: (vaultExists: boolean) => void;
  lock: () => void;
  unlock: (vault: Vault, accounts: TempleAccount[], settings: TempleSettings) => void;
  updateAccounts: (accounts: TempleAccount[]) => void;
  updateSettings: (settings: TempleSettings) => void;
}

export type BackgroundStore = BackgroundState & BackgroundActions;

export const backgroundStore = createStore<BackgroundStore>()(
  subscribeWithSelector(set => ({
    // Initial state
    inited: false,
    vault: null,
    status: TempleStatus.Idle,
    accounts: [],
    networks: [],
    settings: null,

    // Actions
    init: vaultExists =>
      set({
        inited: true,
        status: vaultExists ? TempleStatus.Locked : TempleStatus.Idle,
        networks: NETWORKS
      }),

    lock: () =>
      // SECURITY: Build entirely new state from scratch — never merge with existing
      set({
        inited: true,
        vault: null,
        status: TempleStatus.Locked,
        accounts: [],
        networks: NETWORKS,
        settings: null
      }),

    unlock: (vault, accounts, settings) =>
      set(state => ({
        ...state,
        vault,
        status: TempleStatus.Ready,
        accounts,
        settings
      })),

    updateAccounts: accounts => set(state => ({ ...state, accounts })),

    updateSettings: settings => set(state => ({ ...state, settings }))
  }))
);

/** Strip vault and inited from state for frontend consumption */
export function toFrontState(state: BackgroundState): TempleState {
  return {
    status: state.status,
    accounts: state.accounts,
    networks: state.networks,
    settings: state.settings
  };
}

/** Assert store is initialized */
export function withInited<T>(factory: (state: BackgroundState) => T): T {
  const state = backgroundStore.getState();
  if (!state.inited) throw new Error('Not initialized');
  return factory(state);
}

/** Assert store is unlocked (vault available) */
export function withUnlocked<T>(factory: (state: UnlockedState) => T): T {
  const state = backgroundStore.getState();
  if (!state.inited) throw new Error('Not initialized');
  if (state.status !== TempleStatus.Ready) throw new Error('Not ready');
  return factory(state as UnlockedState);
}
