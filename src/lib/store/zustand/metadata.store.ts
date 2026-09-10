import { z } from 'zod';

import { ALL_PREDEFINED_METADATAS_RECORD } from 'lib/assets/known-tokens';
import { TokenMetadata, TokenStandardsEnum } from 'lib/metadata/types';

import { createDestinationStore } from './destination-store';
import { BrowserStorage } from './persist-storage';
import { SAFE_KEY_SCHEMA } from './validation';

const TOKEN_METADATA_SCHEMA: z.ZodType<TokenMetadata> = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().finite().int().nonnegative(),
  address: z.string(),
  id: z.string(),
  standard: z.nativeEnum(TokenStandardsEnum).optional(),
  thumbnailUri: z.string().optional(),
  displayUri: z.string().optional(),
  artifactUri: z.string().optional()
});
const METADATA_SCHEMA = z.object({
  tokensMetadata: z.record(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA),
  collectiblesMetadata: z.record(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA),
  rwasMetadata: z.record(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA)
});

export type MetadataState = z.infer<typeof METADATA_SCHEMA>;

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
