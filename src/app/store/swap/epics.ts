import { isDefined } from '@rnw-community/shared';
import { BigNumber } from 'bignumber.js';
import { combineEpics, Epic } from 'redux-observable';
import { catchError, from, map, of, switchMap } from 'rxjs';
import { ofType, toPayload } from 'ts-action-operators';

import { fetchRoute3SwapParams } from 'lib/apis/route3/fetch-route3-swap-params';
import { Route3SwapParamsRequest, Route3SwapParamsRequestRaw } from 'lib/route3/interfaces';

import { loadSwapParamsAction, resetSwapParamsAction } from './actions';

const isAmountDefined = (
  requestParams: Route3SwapParamsRequest | Route3SwapParamsRequestRaw
): requestParams is Route3SwapParamsRequest =>
  isDefined(requestParams.amount) &&
  new BigNumber(requestParams.amount).isGreaterThan(0) &&
  requestParams.fromSymbol.length > 0 &&
  requestParams.toSymbol.length > 0;

const loadSwapParamsEpic: Epic = action$ =>
  action$.pipe(
    ofType(loadSwapParamsAction.submit),
    toPayload(),
    switchMap(payload => {
      if (isAmountDefined(payload)) {
        return from(fetchRoute3SwapParams(payload)).pipe(
          map(params => loadSwapParamsAction.success(params)),
          catchError(error => of(loadSwapParamsAction.fail(error.message)))
        );
      }

      return of(resetSwapParamsAction());
    })
  );

export const swapEpics = combineEpics(loadSwapParamsEpic);
