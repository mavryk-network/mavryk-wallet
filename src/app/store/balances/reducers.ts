import { createReducer } from '@reduxjs/toolkit';

import { balancesInitialState } from './state';

// Retained Redux data is an upgrade source only. Live writers use the background balance owner.
export const balancesReducer = createReducer(balancesInitialState, () => undefined);
