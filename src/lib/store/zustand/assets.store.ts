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

// ---- Asset actions factory ------------------------------------------------

type StoreSet = (
  partial: AssetsStore | Partial<AssetsStore> | ((state: AssetsStore) => AssetsStore | Partial<AssetsStore>)
) => void;

/**
 * Generates the four standard actions for an asset type (tokens/collectibles/rwas).
 * Pass removeStale=false for tokens (API returns only changed assets), true for collectibles/rwas.
 */
function createAssetActions(
  assetKey: 'tokens' | 'collectibles' | 'rwas',
  loadingKey: 'tokensLoading' | 'collectiblesLoading' | 'rwasLoading',
  removeStale: boolean,
  set: StoreSet
) {
  return {
    setLoading: (loading: boolean) => set({ [loadingKey]: loading } as Partial<AssetsStore>),

    loadSuccess: (account: string, chainId: string, slugs: string[]) =>
      set(state => {
        const key = getAccountAssetsStoreKey(account, chainId);
        const existing = state[assetKey][key] ?? {};
        const updated = { ...existing };

        if (removeStale) {
          for (const [slug, stored] of Object.entries(updated)) {
            if (stored.manual || stored.status !== 'idle') continue;
            if (!slugs.includes(slug)) delete updated[slug];
          }
        }

        for (const slug of slugs) {
          if (!updated[slug]) updated[slug] = { status: 'idle' };
        }

        return { [assetKey]: { ...state[assetKey], [key]: updated }, [loadingKey]: false } as Partial<AssetsStore>;
      }),

    setStatus: ({ account, chainId, slug, status }: AccountAssetForStore) =>
      set(state => {
        const key = getAccountAssetsStoreKey(account, chainId);
        const accountAssets = state[assetKey][key];
        if (!accountAssets?.[slug]) return state;

        return {
          [assetKey]: {
            ...state[assetKey],
            [key]: { ...accountAssets, [slug]: { ...accountAssets[slug], status } }
          }
        } as Partial<AssetsStore>;
      }),

    putAsIs: (assets: AssetToPut[]) =>
      set(state => {
        const updated = { ...state[assetKey] };

        for (const { slug, account, chainId, status, manual } of assets) {
          const key = getAccountAssetsStoreKey(account, chainId);
          if (!updated[key]) updated[key] = {};
          else updated[key] = { ...updated[key] };
          updated[key][slug] = { status, manual };
        }

        return { [assetKey]: updated } as Partial<AssetsStore>;
      })
  };
}

// ---- Store ----------------------------------------------------------------

export const assetsStore = createStore<AssetsStore>()(
  persist(
    set => {
      const tokens = createAssetActions('tokens', 'tokensLoading', false, set);
      const collectibles = createAssetActions('collectibles', 'collectiblesLoading', true, set);
      const rwas = createAssetActions('rwas', 'rwasLoading', true, set);

      return {
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

        // --- Token actions ---
        setTokensLoading: tokens.setLoading,
        loadAccountTokensSuccess: tokens.loadSuccess,
        setTokenStatus: tokens.setStatus,
        putTokensAsIs: tokens.putAsIs,

        // --- Collectibles actions ---
        setCollectiblesLoading: collectibles.setLoading,
        loadAccountCollectiblesSuccess: collectibles.loadSuccess,
        setCollectibleStatus: collectibles.setStatus,
        putCollectiblesAsIs: collectibles.putAsIs,

        // --- RWAs actions ---
        setRwasLoading: rwas.setLoading,
        loadAccountRwasSuccess: rwas.loadSuccess,
        setRwaStatus: rwas.setStatus,
        putRwasAsIs: rwas.putAsIs,

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

            return { mainnetWhitelist: updatedWhitelist, mainnetWhitelistLoading: false };
          }),

        // --- Scamlist ---
        setScamlistLoading: loading => set({ mainnetScamlistLoading: loading }),

        loadScamlistSuccess: slugs => set({ mainnetScamlist: slugs, mainnetScamlistLoading: false })
      };
    },
    {
      name: 'zustand-assets',
      storage: createThrottledPersistStorage(),
      partialize: (state): Pick<AssetsStore, 'tokens' | 'collectibles' | 'rwas' | 'mainnetWhitelist' | 'mainnetScamlist'> => ({
        tokens: state.tokens,
        collectibles: state.collectibles,
        rwas: state.rwas,
        mainnetWhitelist: state.mainnetWhitelist,
        mainnetScamlist: state.mainnetScamlist
      })
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
