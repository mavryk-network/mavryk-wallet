import { z } from 'zod';

import { mavrykApi, type MavrykApiRequestConfig } from './client';
import { getRetryAfterSeconds, MavrykApiError, toMavrykApiError } from './errors';
import { EquiteezHistorySchema, HistoryOperationSchema, type MavrykHistoryOperation } from './history';
import type { ResolvedMavrykAuthStorageContext } from './storage';

/** The backend returns at most this many top-level groups for a contact preview. */
export const RECENT_OPERATIONS_LIMIT = 3;

export const RECENT_OPERATIONS_STATUSES = ['ready', 'stale', 'preparing'] as const;

const RecentOperationsResponseSchema = z.object({
  walletAddress: z.string(),
  operations: z.array(HistoryOperationSchema).max(RECENT_OPERATIONS_LIMIT),
  status: z.enum(RECENT_OPERATIONS_STATUSES),
  updatedAt: z.string().optional(),
  retryAfterSeconds: z.number().int().nonnegative().optional(),
  equiteezHistory: EquiteezHistorySchema.optional()
});

export type RecentOperationsStatus = (typeof RECENT_OPERATIONS_STATUSES)[number];

export type RecentOperationsResult = Omit<z.infer<typeof RecentOperationsResponseSchema>, 'operations'> & {
  operations: MavrykHistoryOperation[];
};

/**
 * Validates a recent-operations envelope for the requested address. Malformed bodies, a mismatched address
 * or more than three groups throw instead of being truncated or replaced with an empty list.
 */
export function parseRecentOperationsResponse(data: unknown, address: string): RecentOperationsResult {
  const parsed = RecentOperationsResponseSchema.parse(data) as RecentOperationsResult;

  if (parsed.walletAddress !== address) {
    throw new MavrykApiError('Recent operations response is for a different address');
  }

  return parsed;
}

/**
 * Fetches the up-to-three newest operation groups of any implicit address (typically a contact),
 * authenticated as the caller identified by `authContext`, never as the requested address.
 * Both 200 (`ready`/`stale`) and 202 (`preparing`) are successful; `retryAfterSeconds` is the longer of
 * the body and `Retry-After` header hints. Failures throw `MavrykApiError` with status, code and retry delay.
 */
export async function fetchRecentOperations(
  address: string,
  authContext: ResolvedMavrykAuthStorageContext
): Promise<RecentOperationsResult> {
  try {
    const response = await mavrykApi.get<unknown>(`/addresses/${encodeURIComponent(address)}/recent-operations`, {
      _authContext: authContext,
      validateStatus: status => status === 200 || status === 202
    } as MavrykApiRequestConfig);
    const result = parseRecentOperationsResponse(response.data, address);
    const headerRetryAfter = getRetryAfterSeconds(response.headers);
    const retryAfterSeconds =
      headerRetryAfter === undefined && result.retryAfterSeconds === undefined
        ? undefined
        : Math.max(headerRetryAfter ?? 0, result.retryAfterSeconds ?? 0);

    return { ...result, retryAfterSeconds };
  } catch (error) {
    throw toMavrykApiError(error);
  }
}
