import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query client configuration.
 *
 * This client will gradually replace SWR for data fetching and caching.
 * It coexists with SWR during the migration — no consumers are changed yet.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus by default (matches SWR config in client.ts)
      refetchOnWindowFocus: false,
      // Retry once on failure (matches useRetryableSWR's errorRetryCount: 2)
      retry: 2,
      // 30 second stale time to avoid excessive refetching
      staleTime: 30_000
    }
  }
});
