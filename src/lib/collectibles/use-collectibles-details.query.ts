import { useCallback, useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { firstValueFrom } from 'rxjs';

import { fetchObjktCollectibles$ } from 'lib/apis/objkt';
import { toTokenSlug } from 'lib/assets';
import { COLLECTIBLES_DETAILS_SYNC_INTERVAL } from 'lib/fixed-times';
import { tokensKeys } from 'lib/query-keys';

import type { CollectibleDetails, CollectibleDetailsRecord } from './types';
import { convertCollectibleObjktInfoToStateDetailsType } from './utils';

export type { CollectibleDetails, CollectibleDetailsRecord } from './types';

// --- Query keys ---

const collectiblesKeys = {
  details: (slugs: string[]) => ['collectibles-details', ...slugs.sort()] as const
};

// --- Fetch function ---

const fetchCollectiblesDetails = async (slugs: string[]): Promise<CollectibleDetailsRecord> => {
  if (!slugs.length) return {};

  const data = await firstValueFrom(fetchObjktCollectibles$(slugs));
  const details: CollectibleDetailsRecord = {};

  for (const info of data.tokens) {
    const slug = toTokenSlug(info.fa_contract, info.token_id);
    details[slug] = convertCollectibleObjktInfoToStateDetailsType(info, data.galleriesAttributesCounts);
  }

  // Mark missing slugs as null
  for (const slug of slugs) {
    if (!details[slug]) details[slug] = null;
  }

  return details;
};

// --- Query hook ---

export const useCollectiblesDetailsQuery = (slugs: string[]) =>
  useQuery({
    queryKey: collectiblesKeys.details(slugs),
    queryFn: () => fetchCollectiblesDetails(slugs),
    enabled: slugs.length > 0,
    staleTime: COLLECTIBLES_DETAILS_SYNC_INTERVAL,
    refetchInterval: COLLECTIBLES_DETAILS_SYNC_INTERVAL,
    refetchOnWindowFocus: false
  });

// --- Convenience selectors ---

export const useCollectibleDetails = (slug: string): CollectibleDetails | null | undefined => {
  // Use a broad query filter to find the details in any cached query
  const queryClient = useQueryClient();
  const queries = queryClient.getQueriesData<CollectibleDetailsRecord>({
    queryKey: tokensKeys.collectiblesDetails
  });

  return useMemo(() => {
    for (const [, data] of queries) {
      if (data && slug in data) return data[slug];
    }
    return undefined;
  }, [queries, slug]);
};

export const useAllCollectiblesDetails = (): CollectibleDetailsRecord => {
  const queryClient = useQueryClient();
  const queries = queryClient.getQueriesData<CollectibleDetailsRecord>({
    queryKey: tokensKeys.collectiblesDetails
  });

  return useMemo(() => {
    const merged: CollectibleDetailsRecord = {};
    for (const [, data] of queries) {
      if (data) Object.assign(merged, data);
    }
    return merged;
  }, [queries]);
};

export const useCollectiblesDetailsLoading = (): boolean => {
  const queryClient = useQueryClient();
  const state = queryClient.getQueryState(['collectibles-details']);
  return state?.fetchStatus === 'fetching';
};

export const useCollectibleIsAdult = (slug: string): boolean | undefined => {
  const details = useCollectibleDetails(slug);
  if (details === undefined) return undefined;
  return details?.isAdultContent ?? false;
};

export const useLoadCollectiblesDetails = () => {
  const queryClient = useQueryClient();

  return useCallback(
    async (slugs: string[]) => {
      if (!slugs.length) return;
      const data = await fetchCollectiblesDetails(slugs);
      // Merge into existing cache
      queryClient.setQueryData<CollectibleDetailsRecord>(collectiblesKeys.details(slugs), prev => ({
        ...prev,
        ...data
      }));
    },
    [queryClient]
  );
};
