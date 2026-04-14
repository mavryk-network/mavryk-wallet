import { pick } from 'lodash';
import { createStore, useStore } from 'zustand';
import { persist } from 'zustand/middleware';

import type { WhitelistResponseToken } from 'lib/apis/temple';
import { toTokenSlug } from 'lib/assets';
import { ALL_PREDEFINED_METADATAS_RECORD } from 'lib/assets/known-tokens';
import { fromAssetSlug } from 'lib/assets/utils';
import { IS_STAGE_ENV } from 'lib/env';
import type { FetchedMetadataRecord } from 'lib/metadata/fetch';
import type { TokenMetadata } from 'lib/metadata/types';
import { buildTokenMetadataFromFetched, buildTokenMetadataFromWhitelist } from 'lib/metadata/utils';

import { createThrottledPersistStorage } from './throttled-storage';

// Inlined to avoid circular dependency with lib/metadata/index.ts
// RWA_SYMBOLS is a testnet/staging-only list — never classify tokens on mainnet.
const RWA_SYMBOLS = ['ocean', 'mars1', 'ntbm', 'queen'];
const isRwaMetadata = (metadata: Record<string, any>) => {
  // This function uses a hardcoded testnet symbol list and must never run on mainnet
  if (!IS_STAGE_ENV) {
    return false;
  }
  return 'symbol' in metadata && RWA_SYMBOLS.includes(metadata.symbol.toLowerCase());
};

/**
 * Metadata cache store — replaces three Redux slices:
 * - tokens-metadata (Record-based, pre-seeded with known tokens)
 * - collectibles-metadata (was Map-based, now Record for clean serialization)
 * - rwas-metadata (was Map-based, now Record for clean serialization)
 *
 * Persisted to browser.storage.local via Zustand persist middleware.
 */

export type MetadataRecords = Record<string, TokenMetadata>;

export interface MetadataState {
  tokensMetadata: MetadataRecords;
  tokensMetadataLoading: boolean;

  collectiblesMetadata: MetadataRecords;
  collectiblesMetadataLoading: boolean;

  rwasMetadata: MetadataRecords;
  rwasMetadataLoading: boolean;
}

interface MetadataActions {
  // Tokens
  putTokensMetadata: (records: FetchedMetadataRecord, resetLoading?: boolean) => void;
  addWhitelistTokensMetadata: (tokens: WhitelistResponseToken[]) => void;
  refreshTokensMetadata: (records: FetchedMetadataRecord) => void;
  setTokensMetadataLoading: (loading: boolean) => void;

  // Collectibles
  putCollectiblesMetadata: (records: FetchedMetadataRecord, resetLoading?: boolean) => void;
  setCollectiblesMetadataLoading: (loading: boolean) => void;

  // RWAs
  putRwasMetadata: (records: FetchedMetadataRecord, resetLoading?: boolean) => void;
  setRwasMetadataLoading: (loading: boolean) => void;

  // Direct put (from AddAsset page — already-built TokenMetadata, not raw)
  putTokenMetadataDirectly: (slug: string, metadata: TokenMetadata) => void;
  putCollectibleMetadataDirectly: (slug: string, metadata: TokenMetadata) => void;
}

export type MetadataStore = MetadataState & MetadataActions;

export const metadataStore = createStore<MetadataStore>()(
  persist(
    set => ({
      // State
      tokensMetadata: ALL_PREDEFINED_METADATAS_RECORD,
      tokensMetadataLoading: false,

      collectiblesMetadata: {},
      collectiblesMetadataLoading: false,

      rwasMetadata: {},
      rwasMetadataLoading: false,

      // Token actions
      putTokensMetadata: (records, resetLoading) =>
        set(state => {
          const updated = { ...state.tokensMetadata };
          for (const slug of Object.keys(records)) {
            const [address, id] = fromAssetSlug(slug);
            const rawMetadata = records[slug];
            if (!rawMetadata || !id) continue;
            updated[slug] = buildTokenMetadataFromFetched(rawMetadata, address, id);
          }
          return {
            tokensMetadata: updated,
            ...(resetLoading ? { tokensMetadataLoading: false } : {})
          };
        }),

      addWhitelistTokensMetadata: tokens =>
        set(state => {
          const updated = { ...state.tokensMetadata };
          for (const rawMetadata of tokens) {
            const slug = toTokenSlug(rawMetadata.contractAddress, rawMetadata.fa2TokenId);
            if (updated[slug]) continue;
            updated[slug] = buildTokenMetadataFromWhitelist(rawMetadata);
          }
          return { tokensMetadata: updated };
        }),

      refreshTokensMetadata: records =>
        set(state => {
          const keysToRefresh = ['artifactUri', 'displayUri'] as const;
          const updated = { ...state.tokensMetadata };
          for (const slug of Object.keys(records)) {
            const current = updated[slug];
            if (!current) continue;
            const [address, id] = fromAssetSlug(slug);
            const rawMetadata = records[slug];
            if (!rawMetadata || !id) continue;
            const metadata = buildTokenMetadataFromFetched(rawMetadata, address, id);
            updated[slug] = {
              ...current,
              ...pick(metadata, keysToRefresh)
            };
          }
          return { tokensMetadata: updated };
        }),

      setTokensMetadataLoading: loading => set({ tokensMetadataLoading: loading }),

      // Collectibles actions
      putCollectiblesMetadata: (records, resetLoading) =>
        set(state => {
          const updated = { ...state.collectiblesMetadata };
          for (const slug of Object.keys(records)) {
            const metadataRaw = records[slug];
            if (!metadataRaw) continue;
            const [address, id] = fromAssetSlug(slug);
            if (!id) continue;
            updated[slug] = buildTokenMetadataFromFetched(metadataRaw, address, id);
          }
          return {
            collectiblesMetadata: updated,
            ...(resetLoading ? { collectiblesMetadataLoading: false } : {})
          };
        }),

      setCollectiblesMetadataLoading: loading => set({ collectiblesMetadataLoading: loading }),

      // RWAs actions (with isRwa filter)
      putRwasMetadata: (records, resetLoading) =>
        set(state => {
          const updated = { ...state.rwasMetadata };
          for (const slug of Object.keys(records)) {
            const metadataRaw = records[slug];
            if (!metadataRaw || !isRwaMetadata(metadataRaw)) continue;
            const [address, id] = fromAssetSlug(slug);
            if (!id) continue;
            updated[slug] = buildTokenMetadataFromFetched(metadataRaw, address, id);
          }
          return {
            rwasMetadata: updated,
            ...(resetLoading ? { rwasMetadataLoading: false } : {})
          };
        }),

      setRwasMetadataLoading: loading => set({ rwasMetadataLoading: loading }),

      // Direct put (pre-built TokenMetadata)
      putTokenMetadataDirectly: (slug, metadata) =>
        set(state => ({
          tokensMetadata: { ...state.tokensMetadata, [slug]: metadata }
        })),

      putCollectibleMetadataDirectly: (slug, metadata) =>
        set(state => ({
          collectiblesMetadata: { ...state.collectiblesMetadata, [slug]: metadata }
        }))
    }),
    {
      name: 'zustand-metadata',
      storage: createThrottledPersistStorage(),
      partialize: state =>
        ({
          tokensMetadata: state.tokensMetadata,
          collectiblesMetadata: state.collectiblesMetadata,
          rwasMetadata: state.rwasMetadata
        } as unknown as MetadataStore)
    }
  )
);

// Typed selector hook
export const useMetadataStore = <T>(selector: (state: MetadataStore) => T): T => useStore(metadataStore, selector);

// Convenience selectors — match the old Redux selector hook signatures

// Tokens
export const useTokenMetadataSelector = (slug: string) => useMetadataStore(s => s.tokensMetadata[slug]);

export const useAllTokensMetadataSelector = () => useMetadataStore(s => s.tokensMetadata);

export const useTokensMetadataLoadingSelector = () => useMetadataStore(s => s.tokensMetadataLoading);

// Collectibles
export const useCollectibleMetadataSelector = (slug: string) => useMetadataStore(s => s.collectiblesMetadata[slug]);

export const useAllCollectiblesMetadataSelector = () => useMetadataStore(s => s.collectiblesMetadata);

export const useCollectiblesMetadataLoadingSelector = () => useMetadataStore(s => s.collectiblesMetadataLoading);

// RWAs
export const useRwaMetadataSelector = (slug: string) => useMetadataStore(s => s.rwasMetadata[slug]);

export const useAllRwasMetadataSelector = () => useMetadataStore(s => s.rwasMetadata);

export const useRwasMetadataLoadingSelector = () => useMetadataStore(s => s.rwasMetadataLoading);
