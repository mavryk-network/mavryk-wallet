import { createReducer } from '@reduxjs/toolkit';

import { buyWithCreditCardInitialState } from './state';

/** Read-only compatibility shape; fetched results and loading state belong to Query. */
export const buyWithCreditCardReducer = createReducer(buyWithCreditCardInitialState, () => undefined);
