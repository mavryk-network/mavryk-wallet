import { combineEpics, Epic } from 'redux-observable';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { Action } from 'ts-action';
import { ofType, toPayload } from 'ts-action-operators';

import { fetchObjktNFTs$ } from 'lib/apis/objkt';
import { toTokenSlug } from 'lib/assets';

import { loadNFTsDetailsActions } from './actions';
import { NFTDetails, NFTDetailsRecord } from './state';
import { convertNFTObjktInfoToStateDetailsType } from './utils';

const loadNFTsDetailsEpic: Epic = (action$: Observable<Action>) =>
  action$.pipe(
    ofType(loadNFTsDetailsActions.submit),
    toPayload(),
    switchMap(slugs =>
      fetchObjktNFTs$(slugs).pipe(
        map(data => {
          const entries: [string, NFTDetails | null][] = data.tokens.map(info => {
            const slug = toTokenSlug(info.fa_contract, info.token_id);
            const details = convertNFTObjktInfoToStateDetailsType(info, data.galleriesAttributesCounts);

            return [slug, details];
          });

          for (const slug of slugs) {
            if (!data.tokens.some(({ fa_contract, token_id }) => toTokenSlug(fa_contract, token_id) === slug))
              entries.push([slug, null]);
          }

          const details: NFTDetailsRecord = Object.fromEntries(entries);

          return loadNFTsDetailsActions.success({ details, timestamp: Date.now() });
        }),
        catchError((error: unknown) => {
          console.error(error);
          return of(loadNFTsDetailsActions.fail(error instanceof Error ? error.message : 'Unknown error'));
        })
      )
    )
  );

export const nftsEpics = combineEpics(loadNFTsDetailsEpic);
