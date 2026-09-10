import { z } from 'zod';

import { TokenMetadata, TokenStandardsEnum } from 'lib/metadata/types';

import { SAFE_KEY_SCHEMA } from './validation';

export const TOKEN_METADATA_SCHEMA: z.ZodType<TokenMetadata> = z.object({
  name: z.string().max(8192),
  symbol: z.string().max(8192),
  decimals: z.number().finite().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  address: z.string().max(8192),
  id: z.string().max(8192),
  standard: z.nativeEnum(TokenStandardsEnum).optional(),
  thumbnailUri: z.string().max(8192).optional(),
  displayUri: z.string().max(8192).optional(),
  artifactUri: z.string().max(8192).optional()
});
export const METADATA_SCHEMA = z.object({
  tokensMetadata: z.record(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA),
  collectiblesMetadata: z.record(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA),
  rwasMetadata: z.record(SAFE_KEY_SCHEMA, TOKEN_METADATA_SCHEMA)
});

export type MetadataState = z.infer<typeof METADATA_SCHEMA>;
