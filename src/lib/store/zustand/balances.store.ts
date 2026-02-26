import { createStore, useStore } from 'zustand';
import { persist } from 'zustand/middleware';

import { browserStorage } from './persist-storage';

/**
 * Balances store -- replaces the Redux `balances` slice.
 *
 * Shape mirrors the old Redux state:
 *   balancesAtomic: Record<`${pkh}_${chainId}`, { data, isLoading, error }>
 *
 * Actions are called from `useBalancesLoading` (WebSocket / on-block polling)
 * and mutate the store immutably.
 */

export interface BalanceRecord {
  data: StringRecord;
  isLoading: boolean;
  error?: string;
}

export interface BalancesState {
  balancesAtomic: Record<string, BalanceRecord>;
}

interface BalancesActions {
  /** Set gas (MAV) balance for a given account+chain */
  setGasBalance: (publicKeyHash: string, chainId: string, balance: string) => void;

  /** Set gas balance error */
  setGasBalanceError: (publicKeyHash: string, chainId: string, error: string) => void;

  /** Mark assets balances as loading */
  setAssetsBalancesLoading: (publicKeyHash: string, chainId: string) => void;

  /** Merge fetched asset balances into the store */
  setAssetsBalancesSuccess: (publicKeyHash: string, chainId: string, balances: StringRecord) => void;

  /** Set assets balances error */
  setAssetsBalancesError: (publicKeyHash: string, chainId: string, error: string) => void;

  /** Merge a partial set of token balances (e.g. from WebSocket push) */
  putTokensBalances: (publicKeyHash: string, chainId: string, balances: StringRecord) => void;
}

export type BalancesStore = BalancesState & BalancesActions;

const MAV_TOKEN_SLUG = 'mav';

const getKey = (publicKeyHash: string, chainId: string) => `${publicKeyHash}_${chainId}`;

const ensureRecord = (state: BalancesState, key: string): BalanceRecord => {
  const existing = state.balancesAtomic[key];
  if (existing) return existing;
  return { data: {}, isLoading: false };
};

export const balancesStore = createStore<BalancesStore>()(
  persist(
    (set) => ({
      // --- State ---
      balancesAtomic: {},

      // --- Actions ---
      setGasBalance: (publicKeyHash, chainId, balance) =>
        set(state => {
          const key = getKey(publicKeyHash, chainId);
          const prev = ensureRecord(state, key);
          return {
            balancesAtomic: {
              ...state.balancesAtomic,
              [key]: { ...prev, data: { ...prev.data, [MAV_TOKEN_SLUG]: balance } }
            }
          };
        }),

      setGasBalanceError: (publicKeyHash, chainId, error) =>
        set(state => {
          const key = getKey(publicKeyHash, chainId);
          const prev = ensureRecord(state, key);
          return {
            balancesAtomic: {
              ...state.balancesAtomic,
              [key]: { ...prev, error }
            }
          };
        }),

      setAssetsBalancesLoading: (publicKeyHash, chainId) =>
        set(state => {
          const key = getKey(publicKeyHash, chainId);
          const prev = ensureRecord(state, key);
          return {
            balancesAtomic: {
              ...state.balancesAtomic,
              [key]: { ...prev, isLoading: true }
            }
          };
        }),

      setAssetsBalancesSuccess: (publicKeyHash, chainId, balances) =>
        set(state => {
          const key = getKey(publicKeyHash, chainId);
          const prev = ensureRecord(state, key);
          const { error: _discarded, ...rest } = prev;
          return {
            balancesAtomic: {
              ...state.balancesAtomic,
              [key]: { ...rest, data: { ...prev.data, ...balances }, isLoading: false }
            }
          };
        }),

      setAssetsBalancesError: (publicKeyHash, chainId, error) =>
        set(state => {
          const key = getKey(publicKeyHash, chainId);
          const prev = ensureRecord(state, key);
          return {
            balancesAtomic: {
              ...state.balancesAtomic,
              [key]: { ...prev, error, isLoading: false }
            }
          };
        }),

      putTokensBalances: (publicKeyHash, chainId, balances) =>
        set(state => {
          if (Object.keys(balances).length < 1) return state;
          const key = getKey(publicKeyHash, chainId);
          const prev = ensureRecord(state, key);
          return {
            balancesAtomic: {
              ...state.balancesAtomic,
              [key]: { ...prev, data: { ...prev.data, ...balances } }
            }
          };
        })
    }),
    {
      name: 'balances',
      storage: {
        getItem: async (name) => {
          const raw = await browserStorage.getItem(name);
          return raw ? JSON.parse(raw) : null;
        },
        setItem: async (name, value) => {
          await browserStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await browserStorage.removeItem(name);
        }
      }
    }
  )
);

// ---- Selector hooks ----

const EMPTY_BALANCES_RECORD: StringRecord = {};

/** Full balancesAtomic map */
export const useAllBalancesSelector = () => useStore(balancesStore, s => s.balancesAtomic);

/** All balances for a given account + chain */
export const useAllAccountBalancesSelector = (publicKeyHash: string, chainId: string) => {
  const key = getKey(publicKeyHash, chainId);
  return useStore(balancesStore, s => s.balancesAtomic[key]?.data ?? EMPTY_BALANCES_RECORD);
};

/** Single asset balance */
export const useBalanceSelector = (publicKeyHash: string, chainId: string, assetSlug: string): string | undefined => {
  const key = getKey(publicKeyHash, chainId);
  return useStore(balancesStore, s => s.balancesAtomic[key]?.data[assetSlug]);
};

/** Loading flag for a given account + chain */
export const useBalancesLoadingSelector = (publicKeyHash: string, chainId: string) => {
  const key = getKey(publicKeyHash, chainId);
  return useStore(balancesStore, s => s.balancesAtomic[key]?.isLoading ?? false);
};

/** Error for a given account + chain */
export const useBalancesErrorSelector = (publicKeyHash: string, chainId: string) => {
  const key = getKey(publicKeyHash, chainId);
  return useStore(balancesStore, s => s.balancesAtomic[key]?.error);
};

/** Utility: build composite key (same as old Redux getKeyForBalancesRecord) */
export const getKeyForBalancesRecord = getKey;
