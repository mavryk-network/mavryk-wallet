import { CancelledError, QueryClient } from '@tanstack/react-query';

import { METADATA_API_LOAD_CHUNK_SIZE } from 'lib/apis/temple/metadata';
import { withScopedWalletRequest } from 'lib/assets/scoped-wallet-request';
import { isMavSlug } from 'lib/assets/utils';
import { metadataKeys } from 'lib/query-keys';
import { updateOwnedUI } from 'lib/store/zustand/ui-client';
import { fetchWalletTokens, mapWalletTokensToFetchedMetadataRecord } from 'mavryk/api';

import { loadTokensMetadataStrict } from './fetch';
import { getMetadataScopeKey, MetadataCategory, MetadataMode, MetadataScope } from './metadata-scope';
import { beginMetadataSync, normalizeMetadata, syncMetadata } from './sync-metadata';

interface Job {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
  signals: (AbortSignal | undefined)[];
}
interface Batch {
  jobs: Map<string, Job>;
  pending: Set<string>;
  isRunning: boolean;
}
const batches = new WeakMap<QueryClient, Map<string, Batch>>();
const CACHE_TIME = 5 * 60_000;

/** Coalesce overlapping callers, including additions during transport, without caching metadata for UI reads. */
export async function requestMetadata(
  client: QueryClient,
  scope: MetadataScope,
  category: MetadataCategory,
  requested: readonly string[],
  mode: MetadataMode = 'put',
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) throw new CancelledError({ revert: true });
  let registry = batches.get(client);
  if (!registry) batches.set(client, (registry = new Map()));
  const id = JSON.stringify([category, mode, getMetadataScopeKey(scope)]);
  let batch = registry.get(id);
  if (!batch) registry.set(id, (batch = { jobs: new Map(), pending: new Set(), isRunning: false }));
  const current = batch;
  const promises: Promise<void>[] = [];
  for (const slug of new Set(requested)) {
    if (isMavSlug(slug)) continue;
    const receipt = client.getQueryState(metadataKeys.receipt(category, scope, mode, slug));
    if (
      (receipt?.data === 'found' || receipt?.data === 'missing') &&
      !receipt.isInvalidated &&
      Date.now() - receipt.dataUpdatedAt < CACHE_TIME
    )
      continue;
    let job = current.jobs.get(slug);
    if (!job) {
      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      job = { promise, resolve, reject, signals: [] };
      current.jobs.set(slug, job);
      current.pending.add(slug);
    }
    job.signals.push(signal);
    promises.push(job.promise);
  }
  const isWanted = (slug: string) => current.jobs.get(slug)?.signals.some(value => !value?.aborted) ?? false;
  async function run() {
    if (current.isRunning || !current.pending.size) return;
    current.isRunning = true;
    const slugs = [...current.pending].sort();
    current.pending.clear();
    try {
      await client.fetchQuery({
        queryKey: metadataKeys.batch(category, scope, mode, slugs),
        staleTime: 0,
        cacheTime: CACHE_TIME,
        retry: false,
        queryFn: ({ signal: querySignal }) =>
          withScopedWalletRequest(scope, querySignal, async assertScope => {
            const active = slugs.filter(isWanted);
            if (!active.length) throw new CancelledError({ revert: true });
            const request = await beginMetadataSync(scope);
            try {
              const response =
                category === 'tokens'
                  ? mapWalletTokensToFetchedMetadataRecord(
                      active,
                      await fetchWalletTokens({ walletAddress: scope.account })
                    )
                  : Object.assign(
                      {},
                      ...(await Promise.all(
                        Array.from({ length: Math.ceil(active.length / METADATA_API_LOAD_CHUNK_SIZE) }, (_, index) =>
                          loadTokensMetadataStrict(
                            scope.rpcUrl,
                            active.slice(
                              index * METADATA_API_LOAD_CHUNK_SIZE,
                              (index + 1) * METADATA_API_LOAD_CHUNK_SIZE
                            ),
                            scope.chainId
                          )
                        )
                      ))
                    );
              const records = normalizeMetadata(category, active, response);
              await assertScope();
              const remaining = active.filter(isWanted);
              if (!remaining.length) throw new CancelledError({ revert: true });
              const accepted = new Set(remaining);
              for (const slug of Object.keys(records)) if (!accepted.has(slug)) delete records[slug];
              await syncMetadata(request, category, records, mode);
              await assertScope();
              for (const slug of remaining) {
                if (isWanted(slug))
                  client.setQueryData(
                    metadataKeys.receipt(category, scope, mode, slug),
                    records[slug] ? 'found' : 'missing'
                  );
              }
              return true;
            } catch (error) {
              await updateOwnedUI({ kind: 'metadata-sync-cancel', requestId: request.requestId });
              throw error;
            }
          })
      });
      for (const slug of slugs) current.jobs.get(slug)?.resolve();
    } catch (error) {
      for (const slug of slugs) current.jobs.get(slug)?.reject(error);
    } finally {
      for (const slug of slugs) current.jobs.delete(slug);
      current.isRunning = false;
      if (current.pending.size) void run();
      else registry?.delete(id);
    }
  }
  void Promise.resolve().then(run);
  await Promise.all(promises);
  if (signal?.aborted) throw new CancelledError({ revert: true });
}
