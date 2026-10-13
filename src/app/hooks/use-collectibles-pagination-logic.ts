import { useCallback, useState } from 'react';

import { useAllCollectiblesMetadataSelector } from 'app/store/collectibles-metadata/selectors';
import { useRequestMetadata } from 'lib/metadata/use-metadata-query';
import { useDidMount, useDidUpdate } from 'lib/ui/hooks';
import { setNavigateSearchParams } from 'lib/woozie';

export const ITEMS_PER_PAGE = 30;

export const useCollectiblesPaginationLogic = (allSlugsSorted: string[], initialSize: number) => {
  const allMeta = useAllCollectiblesMetadataSelector();

  const requestMetadata = useRequestMetadata('collectibles');

  const [slugs, setSlugs] = useState<string[]>(() => allSlugsSorted.slice(0, initialSize));

  const initialIsLoading = initialSize ? false : Boolean(allSlugsSorted.length);
  const [isLoading, setIsLoading] = useState(initialIsLoading);

  const _load = useCallback(
    async (size: number) => {
      setIsLoading(true);

      const nextSlugs = allSlugsSorted.slice(0, size);

      const slugsWithoutMeta = nextSlugs
        // Not checking metadata of loaded items
        .slice(slugs.length)
        .filter(slug => !allMeta.get(slug));

      if (slugsWithoutMeta.length)
        await requestMetadata(slugsWithoutMeta)
          .then(
            () => {
              setSlugs(nextSlugs);
            },
            () => {
              console.error('Unable to load page metadata');
            }
          )
          .finally(() => setIsLoading(false));
      else {
        setSlugs(nextSlugs);
        setIsLoading(false);
      }

      setNavigateSearchParams({ amount: String(size) });
    },
    [allSlugsSorted, slugs.length, allMeta, requestMetadata]
  );

  useDidMount(() => {
    if (initialIsLoading) _load(ITEMS_PER_PAGE);
  });

  useDidUpdate(() => {
    if (isLoading) return;

    if (slugs.length) _load(slugs.length);
    else if (allSlugsSorted.length) _load(ITEMS_PER_PAGE);
  }, [allSlugsSorted]);

  const loadNext = useCallback(() => {
    if (isLoading || slugs.length === allSlugsSorted.length) return;

    const size = (Math.floor(slugs.length / ITEMS_PER_PAGE) + 1) * ITEMS_PER_PAGE;

    _load(size);
  }, [_load, isLoading, slugs.length, allSlugsSorted.length]);

  return { slugs, isLoading, loadNext };
};
