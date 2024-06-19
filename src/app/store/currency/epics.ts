import { combineEpics, Epic } from 'redux-observable';
import { from, forkJoin, map, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { ofType } from 'ts-action-operators';

import { MARS_TOKEN_SLUG, OCEAN_TOKEN_SLUG } from 'app/consts/rwas';
import { fetchUsdToTokenRates } from 'lib/apis/temple';
import { fetchFiatToTezosRates } from 'lib/fiat-currency';

import { loadExchangeRates } from './actions';

const loadUsdToTokenRates$ = () => from(fetchUsdToTokenRates());
const loadFiatToTezosRates$ = () => from(fetchFiatToTezosRates());

const loadExchangeRatesEpic: Epic = action$ =>
  action$.pipe(
    ofType(loadExchangeRates.submit),
    switchMap(() =>
      forkJoin([loadUsdToTokenRates$(), loadFiatToTezosRates$()]).pipe(
        map(([usdToTokenRates, fiatToTezosRates]) =>
          loadExchangeRates.success({
            usdToTokenRates: {
              ...usdToTokenRates,
              // TODO dake rates for rwa tokens, remove later
              [MARS_TOKEN_SLUG]: '51.094475357904031783253356',
              [OCEAN_TOKEN_SLUG]: '72.844475357904031783253356'
            },
            fiatToTezosRates
          })
        ),
        catchError(error => of(loadExchangeRates.fail(error.message)))
      )
    )
  );

export const currencyEpics = combineEpics(loadExchangeRatesEpic);
