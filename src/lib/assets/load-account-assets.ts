/**
 * Imperative account asset loading functions.
 *
 * These replace the Redux-observable epics in `app/store/assets/epics.ts`.
 * Each function:
 *   1. Calls the existing low-level loader from `app/store/assets/utils.ts`
 *   2. Updates the Zustand balances store with the returned balances
 *   3. Updates the Zustand assets store with the returned slugs
 *   4. Updates the Zustand metadata store with any newly-fetched metadata
 */
import { fixBalances } from 'lib/balances/utils';
import type { MetadataMap } from 'lib/metadata/types';
import { assetsStore } from 'lib/store/zustand/assets.store';
import { balancesStore } from 'lib/store/zustand/balances.store';
import { metadataStore } from 'lib/store/zustand/metadata.store';

import {
  loadAccountTokens as loadAccountTokensRaw,
  loadAccountCollectibles as loadAccountCollectiblesRaw,
  loadAccountRwas as loadAccountRwasRaw
} from './asset-loaders';

// ---- Helpers ---------------------------------------------------------------

/**
 * Build a Map<string, TokenMetadata> from the Zustand metadata store records.
 * The existing loader utils expect a `MetadataMap` (ES Map, not a plain Record).
 */
const buildMetadataMap = (): MetadataMap => {
  const state = metadataStore.getState();
  const map = new Map(Object.entries(state.tokensMetadata));

  for (const [slug, metadata] of Object.entries(state.collectiblesMetadata)) {
    map.set(slug, metadata);
  }

  for (const [slug, metadata] of Object.entries(state.rwasMetadata)) {
    map.set(slug, metadata);
  }

  return map;
};

// ---- Tokens ----------------------------------------------------------------

export const loadAccountTokens = async (account: string, chainId: string) => {
  const store = assetsStore.getState();
  store.setTokensLoading(true);

  try {
    const knownMeta = buildMetadataMap();
    const { slugs, balances, newMeta } = await loadAccountTokensRaw(account, chainId, knownMeta);

    // 1. Update assets store
    assetsStore.getState().loadAccountTokensSuccess(account, chainId, slugs);

    // 2. Update balances in Zustand store
    balancesStore.getState().putTokensBalances(account, chainId, fixBalances(balances));

    // 3. Update metadata in Zustand
    if (newMeta && Object.keys(newMeta).length > 0) {
      metadataStore.getState().putTokensMetadata(newMeta);
    }

    return null;
  } catch (err) {
    assetsStore.getState().setTokensLoading(false);
    console.error('loadAccountTokens failed:', err);
    return null;
  }
};

// ---- Collectibles ----------------------------------------------------------

export const loadAccountCollectibles = async (account: string, chainId: string) => {
  const store = assetsStore.getState();
  store.setCollectiblesLoading(true);

  try {
    const knownMeta = buildMetadataMap();
    const { slugs, balances, newMeta } = await loadAccountCollectiblesRaw(account, chainId, knownMeta);

    // 1. Update assets store
    assetsStore.getState().loadAccountCollectiblesSuccess(account, chainId, slugs);

    // 2. Update balances in Zustand store
    balancesStore.getState().putTokensBalances(account, chainId, fixBalances(balances));

    // 3. Update metadata in Zustand
    if (newMeta && Object.keys(newMeta).length > 0) {
      metadataStore.getState().putCollectiblesMetadata(newMeta);
    }

    return null;
  } catch (err) {
    assetsStore.getState().setCollectiblesLoading(false);
    console.error('loadAccountCollectibles failed:', err);
    return null;
  }
};

// ---- RWAs ------------------------------------------------------------------

export const loadAccountRwas = async (account: string, chainId: string) => {
  const store = assetsStore.getState();
  store.setRwasLoading(true);

  try {
    const knownMeta = buildMetadataMap();
    const { slugs, balances, newMeta } = await loadAccountRwasRaw(account, chainId, knownMeta);

    // 1. Update assets store
    assetsStore.getState().loadAccountRwasSuccess(account, chainId, slugs);

    // 2. Update balances in Zustand store
    balancesStore.getState().putTokensBalances(account, chainId, fixBalances(balances));

    // 3. Update metadata in Zustand
    if (newMeta && Object.keys(newMeta).length > 0) {
      metadataStore.getState().putRwasMetadata(newMeta);
    }

    return null;
  } catch (err) {
    assetsStore.getState().setRwasLoading(false);
    console.error('loadAccountRwas failed:', err);
    return null;
  }
};
