import { createReducer } from '@reduxjs/toolkit';
import { persistReducer } from 'redux-persist';

import { storageConfig, createEntity } from 'lib/store';

import { loadRwasDetailsActions } from './actions';
import { rwasInitialState, RwasState } from './state';

/** In seconds // TTL = Time To Live */
const ADULT_FLAG_TTL = 3 * 60 * 60;

const rwasReducer = createReducer<RwasState>(rwasInitialState, builder => {
  builder.addCase(loadRwasDetailsActions.submit, state => {
    state.details.isLoading = true;
  });

  builder.addCase(loadRwasDetailsActions.success, (state, { payload }) => {
    const { details: detailsRecord, timestamp } = payload;

    const adultFlags = { ...state.adultFlags };
    const timestampInSeconds = Math.round(timestamp / 1_000);

    // Removing expired flags
    for (const [slug, { ts }] of Object.entries(adultFlags)) {
      if (ts + ADULT_FLAG_TTL < timestampInSeconds) delete adultFlags[slug];
    }

    for (const [slug, details] of Object.entries(detailsRecord)) {
      if (details) {
        adultFlags[slug] = { val: details.isAdultContent, ts: timestampInSeconds };
      }
    }

    return {
      ...state,
      details: createEntity({ ...state.details.data, ...detailsRecord }),
      adultFlags
    };
  });

  builder.addCase(loadRwasDetailsActions.fail, (state, { payload }) => {
    state.details.isLoading = false;
    state.details.error = payload;
  });
});

export const rwasPersistedReducer = persistReducer(
  {
    key: 'root.rwas',
    ...storageConfig,
    whitelist: ['adultFlags'] as (keyof RwasState)[]
  },
  rwasReducer
);
