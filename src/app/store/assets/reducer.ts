import { createReducer } from '@reduxjs/toolkit';

import { getAccountAssetsStoreKey } from 'lib/assets/account-assets-key';

import {
  setTokenStatusAction,
  setCollectibleStatusAction,
  putTokensAsIsAction,
  putCollectiblesAsIsAction,
  setRwaStatusAction,
  putRwasAsIsAction
} from './actions';
import { initialState, SliceState } from './state';

const assetsReducer = createReducer<SliceState>(initialState, builder => {
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
});

// Retained legacy payloads are read only; active unrelated Redux data persists in the task11 root.
export const assetsPersistedReducer = assetsReducer;
