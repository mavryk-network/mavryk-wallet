import { createStore } from 'zustand/vanilla';

import { NETWORKS } from 'lib/temple/networks';
import { TempleState, TempleStatus, TempleAccount, TempleSettings } from 'lib/temple/types';

import { Vault } from './vault';

interface StoreState extends TempleState {
  inited: boolean;
  vault: Vault | null;
}

interface UnlockedStoreState extends StoreState {
  vault: Vault;
}

export function toFront({ status, accounts, networks, settings }: StoreState): TempleState {
  return {
    status,
    accounts,
    networks,
    settings
  };
}

/**
 * Store
 */

export const store = createStore<StoreState>(() => ({
  inited: false,
  vault: null,
  status: TempleStatus.Idle,
  accounts: [],
  networks: [],
  settings: null
}));

/**
 * Actions (replace Effector events)
 */

export function inited(vaultExist: boolean) {
  store.setState(state => ({
    ...state,
    inited: true,
    status: vaultExist ? TempleStatus.Locked : TempleStatus.Idle,
    networks: NETWORKS
  }));
}

export function locked() {
  // Attention!
  // Security stuff!
  // Don't merge new state to existing!
  // Build a new state from scratch
  // Reset all properties!
  store.setState(
    {
      inited: true,
      vault: null,
      status: TempleStatus.Locked,
      accounts: [],
      networks: NETWORKS,
      settings: null
    },
    true
  );
}

export function unlocked(payload: { vault: Vault; accounts: TempleAccount[]; settings: TempleSettings }) {
  store.setState(state => ({
    ...state,
    vault: payload.vault,
    status: TempleStatus.Ready,
    accounts: payload.accounts,
    settings: payload.settings
  }));
}

export function accountsUpdated(accounts: TempleAccount[]) {
  store.setState(state => ({
    ...state,
    accounts
  }));
}

export function settingsUpdated(settings: TempleSettings) {
  store.setState(state => ({
    ...state,
    settings
  }));
}

/**
 * Helpers
 */

export function withUnlocked<T>(factory: (state: UnlockedStoreState) => T) {
  const state = store.getState();
  assertUnlocked(state);
  return factory(state);
}

export function withInited<T>(factory: (state: StoreState) => T) {
  const state = store.getState();
  assertInited(state);
  return factory(state);
}

function assertUnlocked(state: StoreState): asserts state is UnlockedStoreState {
  assertInited(state);
  if (state.status !== TempleStatus.Ready) {
    throw new Error('Not ready');
  }
}

function assertInited(state: StoreState) {
  if (!state.inited) {
    throw new Error('Not initialized');
  }
}
