import type { TokenMetadata } from 'lib/metadata';
import { useOwnedUI } from 'lib/store/zustand/ui-client';

import { useSelector } from '../root-state.selector';

export const useTokenMetadataSelector = (slug: string): TokenMetadata | undefined =>
  useOwnedUI(({ metadata }) => metadata.tokensMetadata[slug]);

export const useAllTokensMetadataSelector = () => useOwnedUI(({ metadata }) => metadata.tokensMetadata);

export const useTokensMetadataLoadingSelector = () =>
  useSelector(({ tokensMetadata }) => tokensMetadata.metadataLoading);
