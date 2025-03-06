import { combineEpics, Epic } from 'redux-observable';
import { catchError, map, of, switchMap } from 'rxjs';
import { ofType, toPayload } from 'ts-action-operators';

import { fetchRWADetails$ } from 'lib/apis/rwa';
import { toTokenSlug } from 'lib/assets';

import { loadRwasDetailsActions } from './actions';
import type { RwaDetailsRecord } from './state';

const loadRwasDetailsEpic: Epic = action$ =>
  action$.pipe(
    ofType(loadRwasDetailsActions.submit),
    toPayload(),
    switchMap(slugs =>
      fetchRWADetails$(slugs).pipe(
        map(data => {
          const details: RwaDetailsRecord = {};

          for (const info of data.tokens) {
            const slug = toTokenSlug(info.address, info.token_id);
            const itemDetails = info;

            details[slug] = itemDetails;
          }

          for (const slug of slugs) {
            if (!details[slug]) details[slug] = null;
          }

          return loadRwasDetailsActions.success({ details, timestamp: Date.now() });
        }),
        catchError((error: unknown) => {
          console.error(error);
          return of(loadRwasDetailsActions.fail(error instanceof Error ? error.message : 'Unknown error'));
        })
      )
    )
  );

export const rwasEpics = combineEpics(loadRwasDetailsEpic);
