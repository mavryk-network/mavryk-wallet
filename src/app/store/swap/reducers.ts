import { createReducer } from '@reduxjs/toolkit';

import { createEntity } from 'lib/store';

import { loadSwapParamsAction, resetSwapParamsAction } from './actions';
import { swapInitialState } from './state';
import { DEFAULT_SWAP_PARAMS } from './state.mock';

export const swapReducer = createReducer(swapInitialState, builder => {
  builder.addCase(resetSwapParamsAction, state => {
    state.swapParams = createEntity(DEFAULT_SWAP_PARAMS);
  });
  builder.addCase(loadSwapParamsAction.submit, state => {
    state.swapParams = createEntity(state.swapParams.data, true);
  });
  builder.addCase(loadSwapParamsAction.success, (state, { payload }) => {
    state.swapParams = createEntity(payload, false);
  });
  builder.addCase(loadSwapParamsAction.fail, (state, { payload }) => {
    state.swapParams = createEntity(DEFAULT_SWAP_PARAMS, false, payload);
  });
});
