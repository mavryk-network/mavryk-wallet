import { createReducer } from '@reduxjs/toolkit';

import { currencyInitialState } from './state';

/** Read-only compatibility shape; fetched results and loading state belong to Query. */
export const currencyReducer = createReducer(currencyInitialState, () => undefined);
