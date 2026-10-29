import { createDetailHooks } from 'lib/asset-details/create-detail-hooks';
import { publishAdultFlags } from 'lib/asset-details/publish-adult-flags';
import { useDetailScope } from 'lib/asset-details/use-detail-scope';
import { RWAS_DETAILS_SYNC_INTERVAL } from 'lib/fixed-times';

import type { RwaDetails } from './details.types';
import { fetchScopedRwaDetails } from './fetch-scoped-rwa-details';

export const rwaDetailHooks = createDetailHooks<RwaDetails>({
  category: 'rwas',
  interval: RWAS_DETAILS_SYNC_INTERVAL,
  fetch: (scope, _slugs, signal) => fetchScopedRwaDetails(scope, signal),
  publish: details => publishAdultFlags('rwas', details)
});

export const useRwaDetails = (slug: string) => rwaDetailHooks.useDetail(useDetailScope(), slug);
export const useAllRwaDetails = () => rwaDetailHooks.useAllDetails(useDetailScope());
export const useAreRwaDetailsLoading = () => rwaDetailHooks.useIsLoading(useDetailScope());
export const useRwaDetailsError = () => rwaDetailHooks.useError(useDetailScope());

/** Detail pages join the account batch at the existing detail-page refresh cadence. */
export const useRwaDetailPageBatch = (slug: string, interval: number) =>
  rwaDetailHooks.useBatch(useDetailScope(), [slug], interval);
