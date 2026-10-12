import { combineEpics, Epic } from 'redux-observable';
import { from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ofType, toPayload } from 'ts-action-operators';

import { fetchWalletTokens, mapWalletTokensToFetchedMetadataRecord } from 'mavryk/api';

import { putTokensMetadataAction, loadTokensMetadataAction, resetTokensMetadataLoadingAction } from './actions';

const loadTokensMetadataEpic: Epic = action$ =>
  action$.pipe(
    ofType(loadTokensMetadataAction),
    toPayload(),
    switchMap(({ slugs }) =>
      from(fetchWalletTokens()).pipe(
        map(tokens => mapWalletTokensToFetchedMetadataRecord(slugs, tokens)),
        map(records => putTokensMetadataAction({ records, resetLoading: true })),
        catchError(() => of(resetTokensMetadataLoadingAction()))
      )
    )
  );

export const tokensMetadataEpics = combineEpics(loadTokensMetadataEpic);
