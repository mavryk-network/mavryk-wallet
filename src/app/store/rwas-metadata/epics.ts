import { combineEpics, Epic } from 'redux-observable';
import { from, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ofType, toPayload } from 'ts-action-operators';

import { loadTokensMetadata } from 'lib/metadata/fetch';

import { loadRwasMetadataAction, putRwasMetadataAction, resetRwasMetadataLoadingAction } from './actions';

const loadCollectiblesMetadataEpic: Epic = action$ =>
  action$.pipe(
    ofType(loadRwasMetadataAction),
    toPayload(),
    switchMap(({ rpcUrl, slugs }) =>
      from(loadTokensMetadata(rpcUrl, slugs)).pipe(
        map(records => putRwasMetadataAction({ records, resetLoading: true })),
        catchError(() => of(resetRwasMetadataLoadingAction()))
      )
    )
  );

export const collectiblesMetadataEpics = combineEpics(loadCollectiblesMetadataEpic);
