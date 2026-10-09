import { useOwnedUI } from 'lib/store/zustand/ui-client';

// Compatibility exports for existing callers; fetched details are owned only by Query.
export {
  useRwaDetails as useRwaDetailsSelector,
  useAllRwaDetails as useAllRwaDetailsSelector,
  useAreRwaDetailsLoading as useAllRwasDetailsLoadingSelector
} from 'lib/rwas/use-rwas-details.query';

export const useRwaIsAdultSelector = (slug: string): boolean | undefined =>
  useOwnedUI(state => state.assets.rwaAdultFlags[slug]?.val);
