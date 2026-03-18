import { z } from 'zod';

import { mavrykApi } from './client';
import { extractMavrykApiErrorMessage } from './errors';
import { getWalletAddressFromStorage } from './storage';

const NumberLikeSchema = z.union([z.number(), z.string()]).pipe(z.coerce.number());

const HistoryNetworkFeesSchema = z.object({
  totalFee: NumberLikeSchema,
  usdAmount: NumberLikeSchema.optional(),
  gasFee: NumberLikeSchema,
  storageFee: NumberLikeSchema,
  burnedFromFees: NumberLikeSchema
});

const HistoryParameterSchema = z
  .object({
    entrypoint: z.string().optional(),
    amount: NumberLikeSchema.optional(),
    currency: z.string().optional(),
    usdAmount: NumberLikeSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional()
  })
  .passthrough();

const HistoryOperationSchema = z.object({
  id: NumberLikeSchema,
  hash: z.string(),
  type: z.string(),
  level: NumberLikeSchema.optional(),
  timestamp: z.string(),
  sender: z.string().optional(),
  target: z.string().optional(),
  amount: NumberLikeSchema.optional(),
  parameter: HistoryParameterSchema.nullish(),
  networkFees: HistoryNetworkFeesSchema.optional(),
  status: z.string()
});

const HistoryGroupSchema = z.object({
  type: z.string(),
  hash: z.string(),
  timestamp: z.string(),
  amount: NumberLikeSchema.optional(),
  parameter: HistoryParameterSchema.nullish(),
  networkFees: HistoryNetworkFeesSchema.optional(),
  transferType: z.string().optional(),
  status: z.string(),
  operations: z.array(HistoryOperationSchema)
});

const HistoryResponseSchema = z.object({
  walletAddress: z.string(),
  operations: z.array(HistoryGroupSchema),
  cursor: NumberLikeSchema.nullish(),
  hasMore: z.boolean()
});

export type WalletHistoryFilter = 'sent' | 'received' | 'delegation' | 'staking';
export type MavrykHistoryNetworkFees = z.infer<typeof HistoryNetworkFeesSchema>;
export type MavrykHistoryParameter = z.infer<typeof HistoryParameterSchema>;
export type MavrykHistoryOperation = z.infer<typeof HistoryOperationSchema>;
export type MavrykHistoryGroup = z.infer<typeof HistoryGroupSchema>;
export type MavrykHistoryResponse = z.infer<typeof HistoryResponseSchema>;

export type FetchHistoryRequest = {
  walletAddress?: string;
  limit?: number;
  cursor?: number;
  search?: string;
  filter?: WalletHistoryFilter[];
};

async function getWalletAddressOrThrow(walletAddress?: string) {
  const stored = walletAddress ?? (await getWalletAddressFromStorage());
  if (!stored) throw new Error('No wallet address in storage');
  return stored;
}

function buildHistoryParams(params: FetchHistoryRequest) {
  return {
    limit: params.limit,
    cursor: params.cursor,
    search: params.search,
    filter: params.filter?.length ? params.filter.join(',') : undefined
  };
}

async function fetchHistory(path: string, params: FetchHistoryRequest = {}) {
  try {
    const { data } = await mavrykApi.get<MavrykHistoryResponse>(path, {
      params: buildHistoryParams(params)
    });

    return HistoryResponseSchema.parse(data);
  } catch (error) {
    throw new Error(extractMavrykApiErrorMessage(error));
  }
}

export async function fetchWalletHistory(params: FetchHistoryRequest = {}) {
  const address = await getWalletAddressOrThrow(params.walletAddress);

  return fetchHistory(`/wallets/${address}/history`, params);
}

export async function fetchTokenHistory(tokenAddress: string, params: FetchHistoryRequest = {}) {
  const address = await getWalletAddressOrThrow(params.walletAddress);

  return fetchHistory(`/wallets/${address}/tokens/${tokenAddress}/history`, params);
}

export { extractMavrykApiErrorMessage } from './errors';
