import { createReducer } from '@reduxjs/toolkit';
import { enableMapSet } from 'immer';

import { fromAssetSlug } from 'lib/assets/utils';
import { buildTokenMetadataFromFetched } from 'lib/metadata/utils';

import {
  putCollectiblesMetadataAction,
  loadCollectiblesMetadataAction,
  resetCollectiblesMetadataLoadingAction
} from './actions';
import { collectiblesMetadataInitialState } from './state';

/** See: https://immerjs.github.io/immer/map-set */
enableMapSet();

const collectiblesMetadataReducer = createReducer(collectiblesMetadataInitialState, builder => {
  builder.addCase(putCollectiblesMetadataAction, (state, { payload: { records, resetLoading } }) => {
    for (const slug of Object.keys(records)) {
      const metadataRaw = records[slug];
      if (!metadataRaw) continue;
      const [address, id] = fromAssetSlug(slug);
      if (!id) continue;

      const metadata = buildTokenMetadataFromFetched(metadataRaw, address, id);

      state.records.delete(slug);
      state.records.set(slug, metadata);
    }

    if (resetLoading) state.isLoading = false;
  });

  builder.addCase(loadCollectiblesMetadataAction, state => {
    state.isLoading = true;
  });

  builder.addCase(resetCollectiblesMetadataLoadingAction, state => {
    state.isLoading = false;
  });
});

// Retained legacy payloads are read only; active unrelated Redux data persists in the task11 root.
export const collectiblesMetadataPersistedReducer = collectiblesMetadataReducer;
