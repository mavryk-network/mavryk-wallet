import { createReducer } from '@reduxjs/toolkit';

import { createEntity } from 'lib/store';

import { loadCollectiblesDetailsActions } from './actions';
import { collectiblesInitialState, CollectiblesState } from './state';

const collectiblesReducer = createReducer<CollectiblesState>(collectiblesInitialState, builder => {
  builder.addCase(loadCollectiblesDetailsActions.submit, state => {
    state.details.isLoading = true;
  });

  builder.addCase(loadCollectiblesDetailsActions.success, (state, { payload }) => {
    const { details: detailsRecord } = payload;

    return {
      ...state,
      details: createEntity({ ...state.details.data, ...detailsRecord })
    };
  });

  builder.addCase(loadCollectiblesDetailsActions.fail, (state, { payload }) => {
    state.details.isLoading = false;
    state.details.error = payload;
  });
});

// Retained legacy payloads are read only; active unrelated Redux data persists in the task11 root.
export const collectiblesPersistedReducer = collectiblesReducer;
