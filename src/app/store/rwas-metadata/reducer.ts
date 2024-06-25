import { createReducer } from '@reduxjs/toolkit';
import { enableMapSet } from 'immer';
import { persistReducer } from 'redux-persist';
import hardSet from 'redux-persist/lib/stateReconciler/hardSet';

import { tokenToSlug } from 'lib/assets';
import { fromAssetSlug } from 'lib/assets/utils';
import { TokenMetadata, isRwa } from 'lib/metadata';
import { buildTokenMetadataFromFetched } from 'lib/metadata/utils';
import { storageConfig, createTransformsBeforePersist, createTransformsBeforeHydrate } from 'lib/store';

import { putRwasMetadataAction, loadRwasMetadataAction, resetRwasMetadataLoadingAction } from './actions';
import { rwasMetadataInitialState, SliceState } from './state';

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

export const rwasMetadataPersistedReducer = persistReducer<SliceState>(
  {
    key: 'root.rwasMetadata',
    ...storageConfig,
    stateReconciler: hardSet,
    blacklist: ['isLoading'] as (keyof SliceState)[],
    transforms: [
      /*
        # Persistance. Applied in direct order
      */
      createTransformsBeforePersist<SliceState>({
        records: nonSerializibleRecords => {
          // Converting `records` from `Map` to `Array`
          const serializibleRecords = Array.from(Object.values(nonSerializibleRecords));

          return serializibleRecords as unknown as typeof nonSerializibleRecords;
        }
      }),
      /*
        # Hydration. Applied in reverse order
      */
      createTransformsBeforeHydrate<SliceState>({
        // Converting `records` from `Array` back to `Map`
        records: subState => {
          const serializibleRecords = subState as unknown as TokenMetadata[];

          return new Map(serializibleRecords.map(meta => [tokenToSlug(meta), meta]));
        }
      })
    ]
  },
  rwasMetadataReducer
);
