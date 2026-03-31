import { createStore, useStore } from 'zustand';
import { persist } from 'zustand/middleware';

import type { WhitelistResponseToken } from 'lib/apis/temple';
import { MAV_TOKEN_SLUG, toTokenSlug } from 'lib/assets';

import { createThrottledPersistStorage } from './throttled-storage';

// ---- Types ----------------------------------------------------------------

/** 'idle' for disabled unless balance is positive */
export type StoredAssetStatus = 'idle' | 'enabled' | 'disabled' | 'removed';

export interface StoredAsset {
  status: StoredAssetStatus;
  /** `true` if manually added by user */
  manual?: boolean;
}

export interface AccountAssetForStore {
  slug: string;
  chainId: string;
  /** PKH */
  account: string;
  status: StoredAssetStatus;
}

export type AssetToPut = AccountAssetForStore & StoredAsset;

export type AssetsType = 'collectibles' | 'tokens' | 'rwas';

type AccountAssetsRecord = StringRecord<StoredAsset>;
type StoredAssetsRecords = StringRecord<AccountAssetsRecord>;

// ---- Helpers --------------------------------------------------------------

export const getAccountAssetsStoreKey = (account: string, chainId: string) => `${account}@${chainId}`;

export const isAccountAssetsStoreKeyOfSameChainIdAndDifferentAccount = (
  key: string,
  account: string,
  chainId: string
) => !key.startsWith(account) && key.endsWith(chainId);

// ---- State & Actions ------------------------------------------------------

export interface AssetsState {
  tokens: StoredAssetsRecords;
  tokensLoading: boolean;

  collectibles: StoredAssetsRecords;
  collectiblesLoading: boolean;

  rwas: StoredAssetsRecords;
  rwasLoading: boolean;

  mainnetWhitelist: string[];
  mainnetWhitelistLoading: boolean;

  mainnetScamlist: Record<string, boolean>;
  mainnetScamlistLoading: boolean;
}

interface AssetsActions {
  // --- Tokens loading lifecycle ---
  setTokensLoading: (loading: boolean) => void;
  loadAccountTokensSuccess: (account: string, chainId: string, slugs: string[]) => void;
  setTokenStatus: (payload: AccountAssetForStore) => void;
  putTokensAsIs: (assets: AssetToPut[]) => void;

  // --- Collectibles loading lifecycle ---
  setCollectiblesLoading: (loading: boolean) => void;
  loadAccountCollectiblesSuccess: (account: string, chainId: string, slugs: string[]) => void;
  setCollectibleStatus: (payload: AccountAssetForStore) => void;
  putCollectiblesAsIs: (assets: AssetToPut[]) => void;

  // --- RWAs loading lifecycle ---
  setRwasLoading: (loading: boolean) => void;
  loadAccountRwasSuccess: (account: string, chainId: string, slugs: string[]) => void;
  setRwaStatus: (payload: AccountAssetForStore) => void;
  putRwasAsIs: (assets: AssetToPut[]) => void;

  // --- Whitelist ---
  setWhitelistLoading: (loading: boolean) => void;
  loadWhitelistSuccess: (tokens: WhitelistResponseToken[]) => void;

  // --- Scamlist ---
  setScamlistLoading: (loading: boolean) => void;
  loadScamlistSuccess: (slugs: Record<string, boolean>) => void;
}

export type AssetsStore = AssetsState & AssetsActions;

// ---- Store ----------------------------------------------------------------

export const assetsStore = createStore<AssetsStore>()(
  persist(
    set => ({
      // --- Initial state ---
      tokens: {},
      tokensLoading: false,

      collectibles: {},
      collectiblesLoading: false,

      rwas: {},
      rwasLoading: false,

      mainnetWhitelist: [],
      mainnetWhitelistLoading: false,

      mainnetScamlist: {},
      mainnetScamlistLoading: false,

      // --- Tokens actions ---
      setTokensLoading: loading => set({ tokensLoading: loading }),

      loadAccountTokensSuccess: (account, chainId, slugs) =>
        set(state => {
          const key = getAccountAssetsStoreKey(account, chainId);
          const existing = state.tokens[key] ?? {};
          const updated = { ...existing };

          for (const slug of slugs) {
            if (!updated[slug]) {
              updated[slug] = { status: 'idle' };
            }
          }

          return {
            tokens: { ...state.tokens, [key]: updated },
            tokensLoading: false
          };
        }),

      setTokenStatus: ({ account, chainId, slug, status }) =>
        set(state => {
          const key = getAccountAssetsStoreKey(account, chainId);
          const accountTokens = state.tokens[key];
          if (!accountTokens?.[slug]) return state;

          return {
            tokens: {
              ...state.tokens,
              [key]: {
                ...accountTokens,
                [slug]: { ...accountTokens[slug], status }
              }
            }
          };
        }),

      putTokensAsIs: assets =>
        set(state => {
          const updated = { ...state.tokens };

          for (const { slug, account, chainId, status, manual } of assets) {
            const key = getAccountAssetsStoreKey(account, chainId);
            if (!updated[key]) updated[key] = {};
            else updated[key] = { ...updated[key] };
            updated[key][slug] = { status, manual };
          }

          return { tokens: updated };
        }),

      // --- Collectibles actions ---
      setCollectiblesLoading: loading => set({ collectiblesLoading: loading }),

      loadAccountCollectiblesSuccess: (account, chainId, slugs) =>
        set(state => {
          const key = getAccountAssetsStoreKey(account, chainId);
          const existing = state.collectibles[key] ?? {};
          const updated = { ...existing };

          // Remove no-longer owned collectibles (if not 'idle' or added manually)
          for (const [slug, stored] of Object.entries(updated)) {
            if (stored.manual || stored.status !== 'idle') continue;
            if (!slugs.includes(slug)) {
              const { [slug]: _removed, ...rest } = updated;
              Object.assign(updated, rest);
              delete updated[slug];
            }
          }

          for (const slug of slugs) {
            if (!updated[slug]) {
              updated[slug] = { status: 'idle' };
            }
          }

          return {
            collectibles: { ...state.collectibles, [key]: updated },
            collectiblesLoading: false
          };
        }),

      setCollectibleStatus: ({ account, chainId, slug, status }) =>
        set(state => {
          const key = getAccountAssetsStoreKey(account, chainId);
          const accountCollectibles = state.collectibles[key];
          if (!accountCollectibles?.[slug]) return state;

          return {
            collectibles: {
              ...state.collectibles,
              [key]: {
                ...accountCollectibles,
                [slug]: { ...accountCollectibles[slug], status }
              }
            }
          };
        }),

      putCollectiblesAsIs: assets =>
        set(state => {
          const updated = { ...state.collectibles };

          for (const { slug, account, chainId, status, manual } of assets) {
            const key = getAccountAssetsStoreKey(account, chainId);
            if (!updated[key]) updated[key] = {};
            else updated[key] = { ...updated[key] };
            updated[key][slug] = { status, manual };
          }

          return { collectibles: updated };
        }),

      // --- RWAs actions ---
      setRwasLoading: loading => set({ rwasLoading: loading }),

      loadAccountRwasSuccess: (account, chainId, slugs) =>
        set(state => {
          const key = getAccountAssetsStoreKey(account, chainId);
          const existing = state.rwas[key] ?? {};
          const updated = { ...existing };

          // Remove no-longer owned RWAs (if not 'idle' or added manually)
          for (const [slug, stored] of Object.entries(updated)) {
            if (stored.manual || stored.status !== 'idle') continue;
            if (!slugs.includes(slug)) {
              delete updated[slug];
            }
          }

          for (const slug of slugs) {
            if (!updated[slug]) {
              updated[slug] = { status: 'idle' };
            }
          }

          return {
            rwas: { ...state.rwas, [key]: updated },
            rwasLoading: false
          };
        }),

      setRwaStatus: ({ account, chainId, slug, status }) =>
        set(state => {
          const key = getAccountAssetsStoreKey(account, chainId);
          const accountRwas = state.rwas[key];
          if (!accountRwas?.[slug]) return state;

          return {
            rwas: {
              ...state.rwas,
              [key]: {
                ...accountRwas,
                [slug]: { ...accountRwas[slug], status }
              }
            }
          };
        }),

      putRwasAsIs: assets =>
        set(state => {
          const updated = { ...state.rwas };

          for (const { slug, account, chainId, status, manual } of assets) {
            const key = getAccountAssetsStoreKey(account, chainId);
            if (!updated[key]) updated[key] = {};
            else updated[key] = { ...updated[key] };
            updated[key][slug] = { status, manual };
          }

          return { rwas: updated };
        }),

      // --- Whitelist ---
      setWhitelistLoading: loading => set({ mainnetWhitelistLoading: loading }),

      loadWhitelistSuccess: tokens =>
        set(state => {
          const updatedWhitelist = [...state.mainnetWhitelist];

          for (const token of tokens) {
            if (token.contractAddress === MAV_TOKEN_SLUG) continue;
            const slug = toTokenSlug(token.contractAddress, token.fa2TokenId);
            if (!updatedWhitelist.includes(slug)) updatedWhitelist.push(slug);
          }

          return {
            mainnetWhitelist: updatedWhitelist,
            mainnetWhitelistLoading: false
          };
        }),

      // --- Scamlist ---
      setScamlistLoading: loading => set({ mainnetScamlistLoading: loading }),

      loadScamlistSuccess: slugs =>
        set({
          mainnetScamlist: slugs,
          mainnetScamlistLoading: false
        })
    }),
    {
      name: 'zustand-assets',
      storage: createThrottledPersistStorage(),
      partialize: state =>
        ({
          tokens: state.tokens,
          collectibles: state.collectibles,
          rwas: state.rwas,
          mainnetWhitelist: state.mainnetWhitelist,
          mainnetScamlist: state.mainnetScamlist
        } as unknown as AssetsStore)
    }
  )
);

// ---- Selector hooks -------------------------------------------------------

export const useAssetsStore = <T>(selector: (state: AssetsStore) => T): T => useStore(assetsStore, selector);

const ACCOUNT_ASSETS_EMPTY: AccountAssetsRecord = {};

// Tokens
export const useAllTokensSelector = () => useAssetsStore(s => s.tokens);

export const useAccountTokensSelector = (account: string, chainId: string) =>
  useAssetsStore(s => s.tokens[getAccountAssetsStoreKey(account, chainId)] ?? ACCOUNT_ASSETS_EMPTY);

// Collectibles
export const useAccountCollectiblesSelector = (account: string, chainId: string) =>
  useAssetsStore(s => s.collectibles[getAccountAssetsStoreKey(account, chainId)] ?? ACCOUNT_ASSETS_EMPTY);

// RWAs
export const useAccountRwasSelector = (account: string, chainId: string) =>
  useAssetsStore(s => s.rwas[getAccountAssetsStoreKey(account, chainId)] ?? ACCOUNT_ASSETS_EMPTY);

// Loading
export const useAreAssetsLoading = (type: AssetsType) =>
  useAssetsStore(s => {
    switch (type) {
      case 'tokens':
        return s.tokensLoading;
      case 'collectibles':
        return s.collectiblesLoading;
      case 'rwas':
        return s.rwasLoading;
    }
  });

// Whitelist & Scamlist
export const useMainnetTokensWhitelistSelector = () => useAssetsStore(s => s.mainnetWhitelist);

export const useMainnetTokensScamlistSelector = () => useAssetsStore(s => s.mainnetScamlist);
