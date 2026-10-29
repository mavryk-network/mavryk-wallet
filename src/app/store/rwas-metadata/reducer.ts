import { createReducer } from '@reduxjs/toolkit';
import { enableMapSet } from 'immer';

import { fromAssetSlug } from 'lib/assets/utils';
import { isRwa } from 'lib/metadata/classification';
import { buildTokenMetadataFromFetched } from 'lib/metadata/utils';

import { putRwasMetadataAction, loadRwasMetadataAction, resetRwasMetadataLoadingAction } from './actions';
import { rwasMetadataInitialState } from './state';

/** See: https://immerjs.github.io/immer/map-set */
enableMapSet();

const rwasMetadataReducer = createReducer(rwasMetadataInitialState, builder => {
  builder.addCase(putRwasMetadataAction, (state, { payload: { records, resetLoading } }) => {
    for (const slug of Object.keys(records)) {
      const metadataRaw = records[slug];

      if (!metadataRaw || !isRwa(metadataRaw)) continue;
      const [address, id] = fromAssetSlug(slug);
      if (!id) continue;

      const metadata = buildTokenMetadataFromFetched(metadataRaw, address, id);

      state.records.delete(slug);
      state.records.set(slug, metadata);
    }

    if (resetLoading) state.isLoading = false;
  });

  builder.addCase(loadRwasMetadataAction, state => {
    state.isLoading = true;
  });

  builder.addCase(resetRwasMetadataLoadingAction, state => {
    state.isLoading = false;
  });
});

// Retained legacy payloads are read only; active unrelated Redux data persists in the task11 root.
export const rwasMetadataPersistedReducer = rwasMetadataReducer;
