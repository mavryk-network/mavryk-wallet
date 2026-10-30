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

const HistoryMovementSchema = z
  .object({
    type: z.string().optional(),
    transferType: z.string().optional(),
    movementKind: z.enum(['mint', 'burn']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    contract: z.string().optional(),
    tokenAddress: z.string().optional(),
    tokenId: z.union([z.string(), z.number().int().nonnegative().safe()]).transform(String).optional(),
    timestamp: z.string().optional(),
    amount: z
      .union([
        z.number().finite(),
        z
          .string()
          .trim()
          .min(1)
          .refine(value => Number.isFinite(Number(value)), 'Invalid amount')
      ])
      .optional(),
    rawAmount: z.string().regex(/^\d+$/).optional(),
    currency: z.string().optional(),
    usdAmount: NumberLikeSchema.nullish(),
    entrypoint: z.string().optional(),
    action: z.string().optional(),
    baker: z.string().optional(),
    prevDelegate: z.string().nullable().optional(),
    newDelegate: z.string().nullable().optional(),
    originatedContract: z.string().optional(),
    contractBalance: NumberLikeSchema.optional()
  })
  .passthrough();

const SafeIntegerSchema = z.number().int().safe();
const SignedRawQuantitySchema = z.string().regex(/^-?\d+$/);

const HistoryActionAssetSchema = z
  .object({
    contract: z.string(),
    tokenId: z.union([z.string(), z.number().int().nonnegative().safe()]).transform(String).optional()
  })
  .passthrough();

/**
 * Semantic Equiteez action attached to a history group. Token/order IDs and raw quantities stay strings;
 * raw deltas may be signed. Unknown kinds and execution modes are kept as plain strings.
 */
const HistoryActionSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    operationId: SafeIntegerSchema.optional(),
    counter: SafeIntegerSchema.optional(),
    nonce: SafeIntegerSchema.nonnegative().optional(),
    contract: z.string().optional(),
    participant: z.string().optional(),
    participantRole: z.string().optional(),
    sender: z.string().optional(),
    executionMode: z.string().optional(),
    networkFeePayer: z.string().optional(),
    networkFeeOperationId: SafeIntegerSchema.optional(),
    orderId: z.union([z.string(), SafeIntegerSchema]).transform(String).optional(),
    orderSide: z.string().optional(),
    launch: z.string().optional(),
    asset: HistoryActionAssetSchema.optional(),
    paymentAsset: HistoryActionAssetSchema.optional(),
    rawAmount: SignedRawQuantitySchema.optional(),
    rawPayment: SignedRawQuantitySchema.optional(),
    rawRefund: SignedRawQuantitySchema.optional(),
    distribution: z.string().optional()
  })
  .passthrough();

/** Drops individually malformed actions so one bad entry never rejects the whole history page. */
const HistoryActionsSchema = z.array(z.unknown()).transform(actions =>
  actions.flatMap(action => {
    const parsed = HistoryActionSchema.safeParse(action);
    return parsed.success ? [parsed.data] : [];
  })
);

const HistoryOperationDetailsBaseSchema = HistoryMovementSchema.extend({
  transfers: z.array(HistoryMovementSchema).optional(),
  partialTransfers: z.boolean().optional(),
  transferId: z.string().optional()
});

const HistoryOperationDetailsSchema = HistoryOperationDetailsBaseSchema.extend({
  actions: HistoryActionsSchema.optional()
});

export const EQUITEEZ_HISTORY_STATUSES = ['available', 'stale', 'unavailable'] as const;

/** Enrichment availability; a future unknown status is kept as `unknown` instead of rejecting history. */
const EquiteezHistorySchema = z
  .object({
    status: z
      .string()
      .transform(status =>
        (EQUITEEZ_HISTORY_STATUSES as readonly string[]).includes(status)
          ? (status as (typeof EQUITEEZ_HISTORY_STATUSES)[number])
          : ('unknown' as const)
      )
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
  operationsCount: SafeIntegerSchema.nonnegative().optional(),
  networkFees: HistoryNetworkFeesSchema.optional(),
  status: z.string()
});

const HistoryResponseSchema = z.object({
  walletAddress: z.string(),
  operations: z.array(HistoryOperationSchema),
  cursor: NumberLikeSchema.pipe(z.number().int().safe()).nullish(),
  hasMore: z.boolean(),
  equiteezHistory: EquiteezHistorySchema.optional()
});

export type WalletHistoryFilter =
  | 'sent'
  | 'received'
  | 'delegation'
  | 'staking'
  | 'origination'
  | 'reveal'
  | 'interaction';
export type MavrykHistoryNetworkFees = z.infer<typeof HistoryNetworkFeesSchema>;
export type MavrykHistoryAction = z.infer<typeof HistoryActionSchema>;
export type MavrykEquiteezHistoryStatus = z.infer<typeof EquiteezHistorySchema>['status'];
// Typed from the base schema: `actions` input is unknown[] (lenient parsing), while consumers get parsed actions.
export type MavrykHistoryOperationDetails = z.input<typeof HistoryOperationDetailsBaseSchema> & {
  actions?: MavrykHistoryAction[];
};
export type MavrykHistoryParameter = z.infer<typeof HistoryParameterSchema>;
export type MavrykHistoryOperation = Omit<z.infer<typeof HistoryOperationSchema>, 'operations' | 'details'> & {
  details?: MavrykHistoryOperationDetails | null;
  operations?: MavrykHistoryOperation[];
};
export type MavrykHistoryResponse = Omit<z.infer<typeof HistoryResponseSchema>, 'operations'> & {
  operations: MavrykHistoryOperation[];
};

export type FetchHistoryRequest = {
  walletAddress?: string;
  cursor?: number;
  search?: string;
  filter?: WalletHistoryFilter;
  tokenId?: string;
  limit?: number;
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
    filter: params.filter,
    token_id: params.tokenId,
    limit: params.limit ?? 20
  };
}

/** Validates and normalizes a raw Wallet API history envelope. */
export function parseHistoryResponse(data: unknown) {
  return HistoryResponseSchema.parse(data) as MavrykHistoryResponse;
}

async function fetchHistory(path: string, params: FetchHistoryRequest = {}) {
  try {
    const { data } = await mavrykApi.get<MavrykHistoryResponse>(path, {
      params: buildHistoryParams(params)
    });

    return parseHistoryResponse(data);
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
