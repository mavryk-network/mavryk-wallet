import { createReducer } from '@reduxjs/toolkit';

import { createEntity } from 'lib/store';

import { loadRwasDetailsActions } from './actions';
import { rwasInitialState, RwasState } from './state';

const rwasReducer = createReducer<RwasState>(rwasInitialState, builder => {
  builder.addCase(loadRwasDetailsActions.submit, state => {
    state.details.isLoading = true;
  });

  builder.addCase(loadRwasDetailsActions.success, (state, { payload }) => {
    const { details: detailsRecord } = payload;

    return {
      ...state,
      details: createEntity({ ...state.details.data, ...detailsRecord })
    };
  });

  builder.addCase(loadRwasDetailsActions.fail, (state, { payload }) => {
    state.details.isLoading = false;
    state.details.error = payload;
  });
});

// Retained legacy payloads are read only; active unrelated Redux data persists in the task11 root.
export const rwasPersistedReducer = rwasReducer;
