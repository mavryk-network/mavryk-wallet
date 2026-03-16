import { combineEpics, Epic } from 'redux-observable';
import { from, of, switchMap } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ofType, toPayload } from 'ts-action-operators';

import { toTokenSlug } from 'lib/assets';
import { fetchWalletRwaAssets, walletRwaAssetToDetails } from 'mavryk/api/rwas';

import { loadRwasDetailsActions } from './actions';
import type { RwaDetailsRecord } from './state';

const loadRwasDetailsEpic: Epic = action$ =>
  action$.pipe(
    ofType(loadRwasDetailsActions.submit),
    toPayload(),
    switchMap(({ slugs, walletAddress }) =>
      from(fetchWalletRwaAssets({ walletAddress })).pipe(
        map(data => {
          const details: RwaDetailsRecord = {};

          for (const asset of data) {
            const slug = toTokenSlug(asset.address, 0);
            const itemDetails = walletRwaAssetToDetails(asset);

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
