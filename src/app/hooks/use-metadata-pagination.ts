import { useCallback, useEffect, useState } from 'react';

import { isCancelledError } from '@tanstack/react-query';

import { MetadataCategory } from 'lib/metadata/metadata-scope';
import { useMetadataFetching, useRequestMetadata } from 'lib/metadata/use-metadata-query';
import { useOwnedMetadata } from 'lib/metadata/use-owned-metadata';
import { setNavigateSearchParams } from 'lib/woozie';

export const METADATA_ITEMS_PER_PAGE = 30;

/** Shared pagination keeps only presentation slugs locally and awaits the metadata owner's acknowledgement. */
export function useMetadataPagination(category: MetadataCategory, allSlugsSorted: string[], initialSize: number) {
  const metadata = useOwnedMetadata(category);
  const requestMetadata = useRequestMetadata(category);
  const [page, setPage] = useState({ size: initialSize || METADATA_ITEMS_PER_PAGE });
  const [slugs, setSlugs] = useState(() => allSlugsSorted.slice(0, initialSize));
  const isLoading = useMetadataFetching(category);
  const requested = allSlugsSorted.slice(0, page.size);
  const requestedKey = JSON.stringify(requested);
  const missingKey = JSON.stringify(requested.filter(slug => !metadata[slug]));

  // Fetch committed page inputs; changes/unmount cancel this caller so late results cannot restore an old page.
  useEffect(() => {
    const controller = new AbortController();
    const nextSlugs: string[] = JSON.parse(requestedKey);
    const missing: string[] = JSON.parse(missingKey);
    setSlugs(current => current.filter(slug => nextSlugs.includes(slug)));
    void requestMetadata(missing, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setSlugs(nextSlugs);
      })
      .catch(error => {
        if (!isCancelledError(error)) console.error('Unable to load page metadata');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setNavigateSearchParams({ amount: String(page.size) });
        }
      });
    return () => controller.abort();
  }, [requestMetadata, requestedKey, missingKey, page]);

  const loadNext = useCallback(() => {
    if (isLoading || slugs.length === allSlugsSorted.length) return;
    // A fresh page object also makes an explicitly retried failed first page eligible again.
    setPage({ size: (Math.floor(slugs.length / METADATA_ITEMS_PER_PAGE) + 1) * METADATA_ITEMS_PER_PAGE });
  }, [isLoading, slugs.length, allSlugsSorted.length]);

  return { slugs, isLoading, loadNext };
}
