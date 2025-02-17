import { combineEpics, Epic } from 'redux-observable';
import { catchError, map, of, switchMap } from 'rxjs';
import { ofType, toPayload } from 'ts-action-operators';

import { fetchObjktCollectibles$ } from 'lib/apis/objkt';
import { toTokenSlug } from 'lib/assets';

import { loadRwasDetailsActions } from './actions';
import type { RwaDetailsRecord } from './state';
import { convertRwaObjktInfoToStateDetailsType } from './utils';

const loadRwasDetailsEpic: Epic = action$ =>
  action$.pipe(
    ofType(loadRwasDetailsActions.submit),
    toPayload(),
    switchMap(slugs =>
      // TODO fetch from mavryk api, for npw api isn't available
      fetchObjktCollectibles$(slugs).pipe(
        map(data => {
          const details: RwaDetailsRecord = {};

          for (const info of data.tokens) {
            const slug = toTokenSlug(info.fa_contract, info.token_id);
            const itemDetails = convertRwaObjktInfoToStateDetailsType(info, data.galleriesAttributesCounts);

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
