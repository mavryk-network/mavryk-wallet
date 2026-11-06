import { useOwnedUI } from 'lib/store/zustand/ui-client';

// Compatibility exports for existing callers; fetched details are owned only by Query.
export {
  useCollectibleDetails as useCollectibleDetailsSelector,
  useAllCollectibleDetails as useAllCollectibleDetailsSelector,
  useAreCollectibleDetailsLoading as useAllCollectiblesDetailsLoadingSelector
} from 'lib/collectibles/use-collectibles-details.query';

export const useCollectibleIsAdultSelector = (slug: string): boolean | undefined =>
  useOwnedUI(state => state.assets.collectibleAdultFlags[slug]?.val);
