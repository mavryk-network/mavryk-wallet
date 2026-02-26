import { useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { firstValueFrom } from 'rxjs';

import { fetchRWADetails$ } from 'lib/apis/rwa';
import { toTokenSlug } from 'lib/assets';
import { RWAS_DETAILS_SYNC_INTERVAL } from 'lib/fixed-times';

import type { RwaDetails, RwaDetailsRecord } from './types';

export type { RwaDetails, RwaDetailsRecord } from './types';

// --- Query keys ---

const rwasKeys = {
  details: (slugs: string[]) => ['rwas-details', ...slugs.sort()] as const
};

// --- Fetch function ---

const fetchRwasDetails = async (slugs: string[]): Promise<RwaDetailsRecord> => {
  if (!slugs.length) return {};

  const data = await firstValueFrom(fetchRWADetails$(slugs));
  const details: RwaDetailsRecord = {};

  for (const info of data.tokens) {
    const slug = toTokenSlug(info.address, info.token_id);
    details[slug] = info;
  }

  // Mark missing slugs as null
  for (const slug of slugs) {
    if (!details[slug]) details[slug] = null;
  }

  return details;
};

// --- Query hook ---

export const useRwasDetailsQuery = (slugs: string[]) =>
  useQuery({
    queryKey: rwasKeys.details(slugs),
    queryFn: () => fetchRwasDetails(slugs),
    enabled: slugs.length > 0,
    staleTime: RWAS_DETAILS_SYNC_INTERVAL,
    refetchInterval: RWAS_DETAILS_SYNC_INTERVAL,
    refetchOnWindowFocus: false
  });

// --- Convenience selectors ---

export const useRwaDetails = (slug: string): RwaDetails | null | undefined => {
  const queryClient = useQueryClient();
  const queries = queryClient.getQueriesData<RwaDetailsRecord>({
    queryKey: ['rwas-details']
  });

  return useMemo(() => {
    for (const [, data] of queries) {
      if (data && slug in data) return data[slug];
    }
    return undefined;
  }, [queries, slug]);
};

export const useAllRwasDetails = (): RwaDetailsRecord => {
  const queryClient = useQueryClient();
  const queries = queryClient.getQueriesData<RwaDetailsRecord>({
    queryKey: ['rwas-details']
  });

  return useMemo(() => {
    const merged: RwaDetailsRecord = {};
    for (const [, data] of queries) {
      if (data) Object.assign(merged, data);
    }
    return merged;
  }, [queries]);
};

export const useRwasDetailsLoading = (): boolean => {
  const queryClient = useQueryClient();
  const state = queryClient.getQueryState(['rwas-details']);
  return state?.fetchStatus === 'fetching';
};

export const useRwaIsAdult = (slug: string): boolean | undefined => {
  const details = useRwaDetails(slug);
  if (details === undefined) return undefined;
  return details?.isAdultContent ?? false;
};
