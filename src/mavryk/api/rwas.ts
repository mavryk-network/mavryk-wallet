import { z } from 'zod';

import type { TokenMetadataResponse } from 'lib/apis/temple';
import type { TzktRWAAssetMetadata } from 'lib/apis/tzkt/types';
import { toTokenSlug } from 'lib/assets';
import type { FetchedMetadataRecord } from 'lib/metadata/fetch';
import { tokensToAtoms } from 'lib/temple/helpers';

import { mavrykApi } from './client';
import { getWalletAddressFromStorage } from './storage';

const NumberLikeSchema = z.union([z.number(), z.string()]).pipe(z.coerce.number());

const RwaPriceSchema = z
  .object({
    timestamp: z.string(),
    usd: NumberLikeSchema.optional(),
    eur: NumberLikeSchema.optional(),
    btc: NumberLikeSchema.optional(),
    eth: NumberLikeSchema.optional(),
    jpy: NumberLikeSchema.optional(),
    cny: NumberLikeSchema.optional(),
    krw: NumberLikeSchema.optional(),
    gbp: NumberLikeSchema.optional()
  })
  .partial()
  .passthrough();

const RwaMetadataSchema = z
  .object({
    icon: z.string().optional(),
    name: z.string().optional(),
    symbol: z.string().optional(),
    decimals: z.union([z.string(), z.number()]).optional(),
    thumbnailUri: z.string().optional(),
    shouldPreferSymbol: z.union([z.string(), z.boolean()]).optional(),
    description: z.string().optional()
  })
  .passthrough();

const WalletRwaAssetSchema = z.object({
  address: z.string(),
  symbol: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  balance: NumberLikeSchema,
  usdValue: NumberLikeSchema.optional(),
  price: RwaPriceSchema.optional(),
  metadata: RwaMetadataSchema.optional()
});

const WalletRwaAssetsResponseSchema = z.array(WalletRwaAssetSchema);

export type WalletRwaAsset = z.infer<typeof WalletRwaAssetSchema>;

async function getWalletAddressOrThrow(walletAddress?: string) {
  const stored = walletAddress ?? (await getWalletAddressFromStorage());
  if (!stored) throw new Error('No wallet address in storage');
  return stored;
}

const toOptionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const toMetadataDecimals = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return undefined;
};

const toShouldPreferSymbol = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';

  return false;
};

export async function fetchWalletRwaAssets(params: { walletAddress?: string } = {}) {
  const address = await getWalletAddressOrThrow(params.walletAddress);

  const { data } = await mavrykApi.get<WalletRwaAsset[]>(`/wallets/${address}/assets`);

  return WalletRwaAssetsResponseSchema.parse(data);
}

export const walletRwaAssetToSlug = (asset: Pick<WalletRwaAsset, 'address'>) => toTokenSlug(asset.address, 0);

export function walletRwaAssetToAtomicBalance(asset: WalletRwaAsset) {
  const decimals = Number(toMetadataDecimals(asset.metadata?.decimals) ?? '0');
  return tokensToAtoms(asset.balance, decimals).toFixed();
}

export function walletRwaAssetToMetadata(asset: WalletRwaAsset): TokenMetadataResponse {
  const metadata = asset.metadata ?? {};

  return {
    decimals: Number(toMetadataDecimals(metadata.decimals) ?? '0'),
    symbol: asset.symbol ?? toOptionalString(metadata.symbol),
    name: asset.name ?? toOptionalString(metadata.name),
    thumbnailUri: toOptionalString(metadata.thumbnailUri) ?? toOptionalString(metadata.icon),
    displayUri: undefined,
    artifactUri: undefined
  };
}

export function mapWalletRwaAssetsToFetchedMetadataRecord(assets: WalletRwaAsset[]): FetchedMetadataRecord {
  return assets.reduce<FetchedMetadataRecord>((acc, asset) => {
    acc[walletRwaAssetToSlug(asset)] = walletRwaAssetToMetadata(asset);
    return acc;
  }, {});
}

export function walletRwaAssetToDetails(asset: WalletRwaAsset): TzktRWAAssetMetadata {
  const metadata = asset.metadata ?? {};
  const slug = walletRwaAssetToSlug(asset);

  return {
    address: asset.address,
    slug,
    token_id: 0,
    description: toOptionalString(metadata.description) ?? '',
    name: asset.name ?? toOptionalString(metadata.name) ?? '',
    shouldPreferSymbol: toShouldPreferSymbol(metadata.shouldPreferSymbol),
    symbol: asset.symbol ?? toOptionalString(metadata.symbol) ?? '',
    thumbnailUri: toOptionalString(metadata.thumbnailUri) ?? toOptionalString(metadata.icon),
    identifier: slug,
    decimals: toMetadataDecimals(metadata.decimals)
  };
}
