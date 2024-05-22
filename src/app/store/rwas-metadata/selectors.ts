import { useSelector } from '../root-state.selector';

export const useAllRwasMetadataSelector = () => useSelector(({ rwasMetadata }) => rwasMetadata.records);

export const useRwaMetadataSelector = (slug: string) => useSelector(state => state.rwasMetadata.records.get(slug));

export const useRwasMetadataLoadingSelector = () => useSelector(({ rwasMetadata }) => rwasMetadata.isLoading);
