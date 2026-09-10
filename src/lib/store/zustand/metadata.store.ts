import { ALL_PREDEFINED_METADATAS_RECORD } from 'lib/assets/known-tokens';
import { TokenMetadata } from 'lib/metadata/types';

import { createDestinationStore } from './destination-store';
import { METADATA_SCHEMA } from './metadata-state.schema';
import { BrowserStorage } from './persist-storage';
import { SAFE_KEY_SCHEMA } from './validation';
export type { MetadataState } from './metadata-state.schema';

/** Already-built metadata only. Stored token records override predefined entries; missing predefined entries survive. */
export function createMetadataStore(storage?: BrowserStorage) {
  return createDestinationStore({
    name: 'zustand-metadata',
    storage,
    schema: METADATA_SCHEMA,
    defaults: { tokensMetadata: ALL_PREDEFINED_METADATAS_RECORD, collectiblesMetadata: {}, rwasMetadata: {} },
    merge: (stored, defaults) => ({
      ...stored,
      tokensMetadata: { ...defaults.tokensMetadata, ...stored.tokensMetadata }
    }),
    actions: update => ({
      putTokenMetadataDirectly: (slug: string, metadata: TokenMetadata) =>
        update(draft => {
          draft.tokensMetadata[SAFE_KEY_SCHEMA.parse(slug)] = metadata;
        }),
      putCollectibleMetadataDirectly: (slug: string, metadata: TokenMetadata) =>
        update(draft => {
          draft.collectiblesMetadata[SAFE_KEY_SCHEMA.parse(slug)] = metadata;
        }),
      putRwaMetadataDirectly: (slug: string, metadata: TokenMetadata) =>
        update(draft => {
          draft.rwasMetadata[SAFE_KEY_SCHEMA.parse(slug)] = metadata;
        })
    })
  });
}

export const metadataStore = createMetadataStore();
