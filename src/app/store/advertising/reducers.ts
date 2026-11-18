import { createReducer } from '@reduxjs/toolkit';

import { skipAdvertisingPromotionAction } from './actions';
import { advertisingInitialState, AdvertisingState } from './state';

export const advertisingReducer = createReducer<AdvertisingState>(advertisingInitialState, builder => {
  builder.addCase(skipAdvertisingPromotionAction, state => ({
    ...state,
    lastSeenPromotionName: state.activePromotion.data?.name
  }));
});
