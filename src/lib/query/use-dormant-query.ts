import { QueryKey, useQuery } from '@tanstack/react-query';

/** Read a dormant domain without allowing mount, invalidation or imperative calls to activate its endpoint. */
export function useDormantQuery<T>(queryKey: QueryKey, legacyData?: T) {
  const { data, error, isError, isSuccess, isFetching } = useQuery<T, Error>({
    queryKey,
    queryFn: () => Promise.reject(new Error('This server domain is disabled')),
    initialData: legacyData,
    enabled: false,
    staleTime: Infinity,
    cacheTime: 5 * 60_000,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
  return { data, error, isError, isSuccess, isFetching };
}
