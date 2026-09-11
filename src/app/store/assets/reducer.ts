import { createReducer } from '@reduxjs/toolkit';

import { MAV_TOKEN_SLUG, toTokenSlug } from 'lib/assets';
import { getAccountAssetsStoreKey } from 'lib/assets/account-assets-key';

import {
  loadAccountTokensActions,
  loadAccountCollectiblesActions,
  loadAccountRwasActions,
  loadTokensWhitelistActions,
  setTokenStatusAction,
  setCollectibleStatusAction,
  putTokensAsIsAction,
  putCollectiblesAsIsAction,
  loadTokensScamlistActions,
  setRwaStatusAction,
  putRwasAsIsAction
} from './actions';
import { initialState, SliceState } from './state';

const assetsReducer = createReducer<SliceState>(initialState, builder => {
  builder.addCase(loadAccountTokensActions.submit, state => {
    state.tokens.isLoading = true;
    delete state.tokens.error;
  });

  builder.addCase(loadAccountTokensActions.fail, (state, { payload }) => {
    state.tokens.isLoading = false;
    state.tokens.error = payload ? String(payload) : 'unknown';
  });

  builder.addCase(loadAccountTokensActions.success, state => {
    state.tokens.isLoading = false;
    delete state.tokens.error;
  });

  // collectibles
  builder.addCase(loadAccountCollectiblesActions.submit, state => {
    state.collectibles.isLoading = true;
    delete state.collectibles.error;
  });

  builder.addCase(loadAccountCollectiblesActions.fail, (state, { payload }) => {
    state.collectibles.isLoading = false;
    state.collectibles.error = payload.code ? String(payload.code) : 'unknown';
  });

  builder.addCase(loadAccountCollectiblesActions.success, state => {
    state.collectibles.isLoading = false;
    delete state.collectibles.error;
  });

  // rwas
  builder.addCase(loadAccountRwasActions.submit, state => {
    state.rwas.isLoading = true;
    delete state.rwas.error;
  });

  builder.addCase(loadAccountRwasActions.fail, (state, { payload }) => {
    state.rwas.isLoading = false;
    state.rwas.error = payload.code ? String(payload.code) : 'unknown';
  });

  builder.addCase(loadAccountRwasActions.success, state => {
    state.rwas.isLoading = false;
    delete state.rwas.error;
  });

  builder.addCase(setRwaStatusAction, (state, { payload: { account, chainId, slug, status } }) => {
    const records = state.rwas.data;
    const key = getAccountAssetsStoreKey(account, chainId);
    const rwa = records[key]?.[slug];

    if (rwa) rwa.status = status;
  });

  builder.addCase(putRwasAsIsAction, (state, { payload }) => {
    const records = state.rwas.data;

    for (const asset of payload) {
      const { slug, account, chainId, status, manual } = asset;
      const key = getAccountAssetsStoreKey(account, chainId);
      if (!records[key]) records[key] = {};
      records[key][slug] = { status, manual };
    }
  });

  // --------------

  builder.addCase(setTokenStatusAction, (state, { payload: { account, chainId, slug, status } }) => {
    const records = state.tokens.data;
    const key = getAccountAssetsStoreKey(account, chainId);
    const token = records[key]?.[slug];

    if (token) token.status = status;
  });

  builder.addCase(setCollectibleStatusAction, (state, { payload: { account, chainId, slug, status } }) => {
    const records = state.collectibles.data;
    const key = getAccountAssetsStoreKey(account, chainId);
    const collectible = records[key]?.[slug];

    if (collectible) collectible.status = status;
  });

  builder.addCase(putTokensAsIsAction, (state, { payload }) => {
    const records = state.tokens.data;

    for (const asset of payload) {
      const { slug, account, chainId, status, manual } = asset;
      const key = getAccountAssetsStoreKey(account, chainId);
      if (!records[key]) records[key] = {};
      records[key][slug] = { status, manual };
    }
  });

  builder.addCase(putCollectiblesAsIsAction, (state, { payload }) => {
    const records = state.collectibles.data;

    for (const asset of payload) {
      const { slug, account, chainId, status, manual } = asset;
      const key = getAccountAssetsStoreKey(account, chainId);
      if (!records[key]) records[key] = {};
      records[key][slug] = { status, manual };
    }
  });

  builder.addCase(loadTokensWhitelistActions.submit, state => {
    state.mainnetWhitelist.isLoading = true;
    delete state.mainnetScamlist.error;
  });

  builder.addCase(loadTokensWhitelistActions.fail, (state, { payload }) => {
    state.mainnetWhitelist.isLoading = false;
    state.mainnetWhitelist.error = payload ? String(payload) : 'unknown';
  });

  builder.addCase(loadTokensWhitelistActions.success, (state, { payload }) => {
    state.mainnetWhitelist.isLoading = false;
    delete state.mainnetWhitelist.error;

    for (const token of payload) {
      if (token.contractAddress === MAV_TOKEN_SLUG) continue;
      const slug = toTokenSlug(token.contractAddress, token.fa2TokenId);
      if (!state.mainnetWhitelist.data.includes(slug)) state.mainnetWhitelist.data.push(slug);
    }
  });

  builder.addCase(loadTokensScamlistActions.submit, state => {
    state.mainnetScamlist.isLoading = true;
    delete state.mainnetScamlist.error;
  });

  builder.addCase(loadTokensScamlistActions.fail, (state, { payload }) => {
    state.mainnetScamlist.isLoading = false;
    state.mainnetScamlist.error = payload ? String(payload) : 'unknown';
  });

  builder.addCase(loadTokensScamlistActions.success, (state, { payload }) => {
    state.mainnetScamlist.isLoading = false;
    delete state.mainnetScamlist.error;

    state.mainnetScamlist.data = payload;
  });
});

// Retained legacy payloads are read only; active unrelated Redux data persists in the task11 root.
export const assetsPersistedReducer = assetsReducer;
