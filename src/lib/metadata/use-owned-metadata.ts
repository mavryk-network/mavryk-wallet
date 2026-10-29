import { useMemo } from 'react';

import { useOwnedUI } from 'lib/store/zustand/ui-client';

import { getMetadataScopeKey, MetadataCategory } from './metadata-scope';
import { selectLegacyMetadata, selectScopedMetadata, selectSeedMetadata } from './owned-metadata';
import { useMetadataScope } from './use-metadata-scope';

/** Scoped fetched/user records win; retained legacy records remain an explicitly unscoped fallback. */
export function useOwnedMetadata(category: MetadataCategory) {
  const scope = useMetadataScope();
  const scopeKey = getMetadataScopeKey(scope);
  const legacy = useOwnedUI(state => selectLegacyMetadata(state, category));
  const scoped = useOwnedUI(state => selectScopedMetadata(state, scopeKey, category));
  const seeds = useOwnedUI(state => selectSeedMetadata(state, scope.chainId, category));
  return useMemo(() => (scoped || seeds ? { ...seeds, ...legacy, ...scoped } : legacy), [legacy, scoped, seeds]);
}
