import { createAction } from '@reduxjs/toolkit';

import type { Route3Dex } from 'lib/apis/route3/fetch-route3-dexes';
import type { Route3Token } from 'lib/apis/route3/fetch-route3-tokens';
import type { Route3SwapParamsRequestRaw, Route3SwapParamsResponse } from 'lib/route3/interfaces';
import { createActions } from 'lib/store';

export const loadSwapParamsAction = createActions<Route3SwapParamsRequestRaw, Route3SwapParamsResponse, string>(
  'swap/LOAD_SWAP_PARAMS'
);
export const resetSwapParamsAction = createAction('swap/RESET_SWAP_PARAMS');
export const loadSwapTokensAction = createActions<void, Array<Route3Token>, string>('swap/LOAD_ROUTE3_TOKENS');
export const loadSwapDexesAction = createActions<void, Array<Route3Dex>, string>('swap/LOAD_ROUTE3_DEXES');
