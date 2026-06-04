import { z } from 'zod';

import type { TokenMetadataResponse } from 'lib/apis/temple';
import { fromAssetSlug, toTokenSlug } from 'lib/assets/utils';

import { mavrykApi } from './client';
import { getWalletAddressFromStorage } from './storage';

const WalletTokenSortSchema = z.enum(['value_desc', 'value_asc', 'name']);
const NumberLikeSchema = z.union([z.number(), z.string()]).pipe(z.coerce.number());

const WalletTokenSchema = z.object({
  address: z.string(),
  balance: NumberLikeSchema,
  metadata: z
    .unknown()
    .optional()
    .transform(value => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {})),
  name: z.string().nullable().optional(),
  symbol: z.string().nullable().optional(),
  usdValue: NumberLikeSchema.optional()
});

const WalletTokensResponseSchema = z.array(WalletTokenSchema);

export type WalletTokenSort = z.infer<typeof WalletTokenSortSchema>;
export type WalletToken = z.infer<typeof WalletTokenSchema>;

export type FetchWalletTokensRequest = {
  walletAddress?: string;
  sort?: WalletTokenSort;
  search?: string;
};

async function getWalletAddressOrThrow(walletAddress?: string) {
  const stored = walletAddress ?? (await getWalletAddressFromStorage());
  if (!stored) throw new Error('No wallet address in storage');
  return stored;
}

export async function fetchWalletTokens(params: FetchWalletTokensRequest = {}) {
  const address = await getWalletAddressOrThrow(params.walletAddress);

  const { data } = await mavrykApi.get<WalletToken[]>(`/wallets/${address}/tokens`, {
    params: {
      sort: params.sort,
      search: params.search
    }
  });

  return WalletTokensResponseSchema.parse(data);
}

const toOptionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const toMetadataDecimals = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
};

const metadataTokenIdKeys = ['tokenId', 'token_id', 'fa2TokenId', 'fa2_token_id', 'id'] as const;

function getTokenIdFromMetadata(metadata: Record<string, unknown>): string | undefined {
  for (const key of metadataTokenIdKeys) {
    const value = metadata[key];
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'string' && value.length > 0) return value;
  }

  return undefined;
}

function walletTokenToTokenMetadataResponse(token: WalletToken): TokenMetadataResponse {
  const metadata = token.metadata;

  return {
    decimals: toMetadataDecimals(metadata.decimals),
    symbol: token.symbol ?? toOptionalString(metadata.symbol),
    name: token.name ?? toOptionalString(metadata.name),
    thumbnailUri:
      toOptionalString(metadata.thumbnailUri) ??
      toOptionalString(metadata.thumbnail_uri) ??
      toOptionalString(metadata.image),
    displayUri: toOptionalString(metadata.displayUri) ?? toOptionalString(metadata.display_uri),
    artifactUri: toOptionalString(metadata.artifactUri) ?? toOptionalString(metadata.artifact_uri)
  };
}

export function mapWalletTokensToFetchedMetadataRecord(slugs: string[], tokens: WalletToken[]) {
  const record: Record<string, TokenMetadataResponse | null> = {};
  const requested = new Set(slugs);
  const slugsByAddress = new Map<string, string[]>();

  for (const slug of slugs) {
    record[slug] = null;

    const [address] = fromAssetSlug(slug);
    const existing = slugsByAddress.get(address);
    if (existing) {
      existing.push(slug);
    } else {
      slugsByAddress.set(address, [slug]);
    }
  }

  for (const token of tokens) {
    const tokenId = getTokenIdFromMetadata(token.metadata) ?? '0';
    const preciseSlug = toTokenSlug(token.address, tokenId);
    const mappedMetadata = walletTokenToTokenMetadataResponse(token);

    if (requested.has(preciseSlug)) {
      record[preciseSlug] = mappedMetadata;
      continue;
    }

    const addressSlugs = slugsByAddress.get(token.address);
    if (addressSlugs?.length === 1) {
      record[addressSlugs[0]!] = mappedMetadata;
    }
  }

  return record;
}
