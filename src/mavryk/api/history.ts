import { z } from 'zod';

import { mavrykApi } from './client';
import { extractMavrykApiErrorMessage } from './errors';
import { getWalletAddressFromStorage } from './storage';

const NumberLikeSchema = z.union([z.number(), z.string()]).pipe(z.coerce.number());

const HistoryNetworkFeesSchema = z.object({
  totalFee: NumberLikeSchema,
  usdAmount: NumberLikeSchema.optional(),
  gasFee: NumberLikeSchema,
  bakerFee: NumberLikeSchema.optional(),
  storageFee: NumberLikeSchema,
  burnedFromFees: NumberLikeSchema
});

const HistoryOperationDetailsSchema = z
  .object({
    type: z.string().optional(),
    transferType: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    contract: z.string().optional(),
    tokenAddress: z.string().optional(),
    tokenId: NumberLikeSchema.optional(),
    timestamp: z.string().optional(),
    amount: NumberLikeSchema.optional(),
    currency: z.string().optional(),
    usdAmount: NumberLikeSchema.optional(),
    entrypoint: z.string().optional(),
    action: z.string().optional(),
    baker: z.string().optional(),
    prevDelegate: z.string().nullable().optional(),
    newDelegate: z.string().nullable().optional(),
    originatedContract: z.string().optional(),
    contractBalance: NumberLikeSchema.optional()
  })
  .passthrough();

const HistoryParameterSchema = z
  .object({
    entrypoint: z.string().optional(),
    amount: NumberLikeSchema.optional(),
    currency: z.string().optional(),
    usdAmount: NumberLikeSchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    value: z.unknown().optional()
  })
  .passthrough();

const HistoryOperationSchema = z.object({
  id: NumberLikeSchema.optional(),
  hash: z.string(),
  type: z.string(),
  role: z.string().optional(),
  block: z.string().optional(),
  level: NumberLikeSchema.optional(),
  counter: NumberLikeSchema.optional(),
  timestamp: z.string().optional(),
  sender: z.string().optional(),
  target: z.string().optional(),
  amount: NumberLikeSchema.optional(),
  parameter: HistoryParameterSchema.nullish(),
  details: HistoryOperationDetailsSchema.nullish(),
  gasLimit: NumberLikeSchema.optional(),
  gasUsed: NumberLikeSchema.optional(),
  storageLimit: NumberLikeSchema.optional(),
  storageUsed: NumberLikeSchema.optional(),
  action: z.string().optional(),
  baker: z.string().optional(),
  prevDelegate: z.string().nullable().optional(),
  newDelegate: z.string().nullable().optional(),
  originatedContract: z.string().optional(),
  contractBalance: NumberLikeSchema.optional(),
  operations: z.array(z.unknown()).optional(),
  networkFees: HistoryNetworkFeesSchema.optional(),
  status: z.string()
});

const HistoryResponseSchema = z.object({
  walletAddress: z.string(),
  operations: z.array(HistoryOperationSchema),
  cursor: NumberLikeSchema.nullish(),
  hasMore: z.boolean()
});

export type WalletHistoryFilter = 'sent' | 'received' | 'delegation' | 'staking';
export type MavrykHistoryNetworkFees = z.infer<typeof HistoryNetworkFeesSchema>;
export type MavrykHistoryOperationDetails = z.infer<typeof HistoryOperationDetailsSchema>;
export type MavrykHistoryParameter = z.infer<typeof HistoryParameterSchema>;
export type MavrykHistoryOperation = Omit<z.infer<typeof HistoryOperationSchema>, 'operations'> & {
  operations?: MavrykHistoryOperation[];
};
export type MavrykHistoryResponse = Omit<z.infer<typeof HistoryResponseSchema>, 'operations'> & {
  operations: MavrykHistoryOperation[];
};

export type FetchHistoryRequest = {
  walletAddress?: string;
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

    return HistoryResponseSchema.parse(data) as MavrykHistoryResponse;
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
