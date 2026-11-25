import { firstValueFrom, fromEvent, takeUntil } from 'rxjs';

import { fetchObjktCollectibles$ } from 'lib/apis/objkt';
import { createDetailHooks } from 'lib/asset-details/create-detail-hooks';
import { publishAdultFlags } from 'lib/asset-details/publish-adult-flags';
import { useDetailScope } from 'lib/asset-details/use-detail-scope';
import { toTokenSlug } from 'lib/assets/utils';
import { COLLECTIBLES_DETAILS_SYNC_INTERVAL } from 'lib/fixed-times';

import { convertCollectibleObjktInfoToStateDetailsType } from './details.helpers';
import type { CollectibleDetails, CollectibleDetailsRecord } from './details.types';

export const collectibleDetailHooks = createDetailHooks<CollectibleDetails>({
  category: 'collectibles',
  interval: COLLECTIBLES_DETAILS_SYNC_INTERVAL,
  fetch: async (_scope, slugs, signal) => {
    const request = fetchObjktCollectibles$(slugs);
    const data = await firstValueFrom(signal ? request.pipe(takeUntil(fromEvent(signal, 'abort'))) : request);
    const details: CollectibleDetailsRecord = {};
    for (const info of data.tokens) {
      details[toTokenSlug(info.fa_contract, info.token_id)] = convertCollectibleObjktInfoToStateDetailsType(
        info,
        data.galleriesAttributesCounts
      );
    }
    return details;
  },
  publish: details => publishAdultFlags('collectibles', details)
});

export const useCollectibleDetails = (slug: string) => collectibleDetailHooks.useDetail(useDetailScope(), slug);
export const useAllCollectibleDetails = () => collectibleDetailHooks.useAllDetails(useDetailScope());
export const useAreCollectibleDetailsLoading = () => collectibleDetailHooks.useIsLoading(useDetailScope());
export const useCollectibleDetailsError = () => collectibleDetailHooks.useError(useDetailScope());

/** Detail pages join the account batch, including direct links to assets outside the account list. */
export const useCollectibleDetailPageBatch = (slug: string, interval: number) =>
  collectibleDetailHooks.useBatch(useDetailScope(), [slug], interval);
