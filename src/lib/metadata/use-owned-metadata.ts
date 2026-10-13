import { useMemo } from 'react';

import { useOwnedUI } from 'lib/store/zustand/ui-client';
import { TempleChainId } from 'lib/temple/types';

import { getMetadataScopeKey, MetadataCategory, WHITELIST_METADATA_SCOPE_KEY } from './metadata-scope';
import { useMetadataScope } from './use-metadata-scope';

/** Scoped fetched/user records win; retained legacy records remain an explicitly unscoped fallback. */
export function useOwnedMetadata(category: MetadataCategory) {
  const scope = useMetadataScope();
  const scopeKey = getMetadataScopeKey(scope);
  const field = `${category}Metadata` as const;
  const legacy = useOwnedUI(state => state.metadata[field]);
  const scoped = useOwnedUI(state => state.metadata.scoped?.[scopeKey]?.[field]);
  const seeds = useOwnedUI(state =>
    scope.chainId === TempleChainId.Mainnet ? state.metadata.scoped?.[WHITELIST_METADATA_SCOPE_KEY]?.[field] : undefined
  );
  return useMemo(() => (scoped || seeds ? { ...seeds, ...legacy, ...scoped } : legacy), [legacy, scoped, seeds]);
}
