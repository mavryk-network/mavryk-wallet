import { useEffect } from 'react';

import {
  CancelledError,
  isCancelledError,
  QueryClient,
  useIsFetching,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';

import { assetDetailsKeys, serializeQueryKey } from 'lib/query-keys';

import { DetailCategory, DetailRecord, DetailScope } from './details.types';

interface DetailConfig<T> {
  category: DetailCategory;
  interval: number;
  fetch: (scope: DetailScope, slugs: string[], signal?: AbortSignal) => Promise<DetailRecord<T>>;
  publish: (details: DetailRecord<T>) => Promise<unknown>;
}

interface Registration {
  slugs: string[];
  interval: number;
}

const EMPTY_DETAILS = {};

/** Shares scheduling across mounts; Query alone owns results, request state and in-flight deduplication. */
export function createDetailHooks<T>(config: DetailConfig<T>) {
  const drivers = new WeakMap<QueryClient, Map<string, ReturnType<typeof createDriver>>>();
  const batchKey = (scope: DetailScope) =>
    assetDetailsKeys.batch(config.category, scope.account, scope.chainId, scope.networkId);
  const leafKey = (scope: DetailScope, slug: string) =>
    assetDetailsKeys.leaf(config.category, scope.account, scope.chainId, scope.networkId, slug);

  function createDriver(client: QueryClient, scope: DetailScope, dispose: () => void) {
    const registrations = new Map<symbol, Registration>();
    const key = batchKey(scope);
    let slugs: string[] = [];
    let revision = 0;
    let interval = config.interval;
    let isRunning = false;
    let isQueued = false;
    let isDisposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function run() {
      if (isRunning || isDisposed || !slugs.length) return;
      if (timer !== undefined) clearTimeout(timer);
      isRunning = true;
      const requested = slugs.slice();
      const requestRevision = revision;
      try {
        await client.fetchQuery({
          queryKey: key,
          staleTime: 0,
          retry: false,
          queryFn: async ({ signal }) => {
            const assertActive = () => {
              if (isDisposed || signal?.aborted) throw new CancelledError({ revert: true });
            };
            const response = await config.fetch(scope, requested, signal);
            assertActive();
            const details: DetailRecord<T> = {};
            // Only requested, still-selected assets can receive a confirmed miss or a value.
            for (const slug of requested) if (slugs.includes(slug)) details[slug] = response[slug] ?? null;
            await config.publish(details);
            assertActive();
            for (const [slug, value] of Object.entries(details)) {
              if (slugs.includes(slug)) client.setQueryData(leafKey(scope, slug), value);
              else delete details[slug];
            }
            return details;
          }
        });
      } catch (error) {
        // Query retains the error and usable cached data. Cancellation is not a successful empty response.
        if (!isCancelledError(error)) console.error('Unable to refresh asset details');
      } finally {
        isRunning = false;
        if (!isDisposed) {
          if (requestRevision !== revision) void run();
          else if (slugs.length) timer = setTimeout(() => void run(), interval);
        }
      }
    }

    function reconcile() {
      isQueued = false;
      if (!registrations.size) {
        isDisposed = true;
        if (timer !== undefined) clearTimeout(timer);
        void client.cancelQueries({ queryKey: key, exact: true });
        dispose();
        return;
      }
      const nextSlugs = [...new Set([...registrations.values()].flatMap(item => item.slugs))].sort();
      const nextInterval = Math.min(...[...registrations.values()].map(item => item.interval));
      const hasChanged = serializeQueryKey(nextSlugs) !== serializeQueryKey(slugs);
      const hasFasterInterval = nextInterval < interval;
      interval = nextInterval;
      if (hasChanged) {
        slugs = nextSlugs;
        revision++;
      }
      if (!slugs.length) {
        if (timer !== undefined) clearTimeout(timer);
        void client.cancelQueries({ queryKey: key, exact: true });
        client.setQueryData(key, {});
      } else if (hasChanged || hasFasterInterval) void run();
    }

    function schedule() {
      if (isQueued) return;
      isQueued = true;
      // Coalesce sibling mounts and React effect cleanup/setup before starting any transport.
      void Promise.resolve().then(reconcile);
    }

    return {
      register(registration: Registration) {
        const id = Symbol();
        registrations.set(id, registration);
        schedule();
        return () => {
          registrations.delete(id);
          schedule();
        };
      }
    };
  }

  /** Register a set with the sole batch driver. Changes during a request queue a follow-up batch. */
  function useBatch(scope: DetailScope, requestedSlugs: readonly string[], interval = config.interval) {
    const client = useQueryClient();
    const { account, chainId, networkId } = scope;
    const slugsKey = JSON.stringify([...new Set(requestedSlugs)].sort());
    // Register committed inputs and release them on scope changes/unmount; the last release cancels the timer/request.
    useEffect(() => {
      if (!account || !chainId || !networkId) return;
      let registry = drivers.get(client);
      if (!registry) {
        registry = new Map();
        drivers.set(client, registry);
      }
      const currentScope = { account, chainId, networkId };
      const id = serializeQueryKey(batchKey(currentScope));
      let driver = registry.get(id);
      if (!driver) {
        driver = createDriver(client, currentScope, () => registry?.delete(id));
        registry.set(id, driver);
      }
      const slugs: string[] = JSON.parse(slugsKey);
      return driver.register({ slugs, interval });
    }, [client, account, chainId, networkId, slugsKey, interval]);
  }

  /** Disabled observers have no query function or exposed refetch callback, including after invalidation. */
  function useDetail(scope: DetailScope, slug: string) {
    return useQuery<T | null>({
      queryKey: leafKey(scope, slug),
      enabled: false,
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    }).data;
  }

  /** All-record consumers (sorting) subscribe to the batch result without registering a fetcher. */
  function useAllDetails(scope: DetailScope): DetailRecord<T> {
    return (
      useQuery<DetailRecord<T>>({ queryKey: batchKey(scope), enabled: false, staleTime: Infinity }).data ??
      EMPTY_DETAILS
    );
  }

  function useIsLoading(scope: DetailScope) {
    return useIsFetching({ queryKey: batchKey(scope) }) > 0;
  }

  function useError(scope: DetailScope) {
    return useQuery<DetailRecord<T>, Error>({ queryKey: batchKey(scope), enabled: false }).error;
  }

  return { useBatch, useDetail, useAllDetails, useIsLoading, useError };
}
