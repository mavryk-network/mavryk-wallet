import BigNumber from 'bignumber.js';
import { z } from 'zod';

import type { MavrykHistoryOperation } from 'mavryk/api/history';

import type { HistoryDisplayMoneyDiff } from './types';

const unsigned = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative().safe()]).transform(String);
const allocationSchema = z.object({ owner: z.string().min(1), amount: unsigned, token_id: unsigned });
const transfersSchema = z.array(
  z.object({
    from_: z.string().min(1),
    txs: z.array(z.object({ to_: z.string().min(1), amount: unsigned, token_id: unsigned }))
  })
);

export interface PurchaseMovement {
  operationIndex: number;
  assetSlug: string;
  contract: string;
  tokenId: string;
  from: string;
  to: string;
  atomicAmount: string;
  isMint: boolean;
}

/** Decode only the observed mint allocation and FA2 transfer encodings; never infer purchase limits as debits. */
export function getPurchaseMovements(operations: MavrykHistoryOperation[]): PurchaseMovement[] {
  const seen = new Set<string>();
  return operations.flatMap((operation, operationIndex) => {
    if (operation.id !== undefined) {
      const key = `${operation.hash}:${operation.id}`;
      if (seen.has(key)) return [];
      seen.add(key);
    }
    const contract = operation.target;
    if (!contract?.startsWith('KT1')) return [];
    const entrypoint = operation.parameter?.entrypoint;
    const value = operation.parameter?.value;
    const makeMovement = (from: string, to: string, amount: string, tokenId: string, isMint: boolean) => ({
      operationIndex,
      contract,
      assetSlug: `${contract}_${new BigNumber(tokenId).toFixed()}`,
      tokenId: new BigNumber(tokenId).toFixed(),
      from,
      to,
      atomicAmount: amount,
      isMint
    });
    if (entrypoint === 'mint') {
      const result = z.array(allocationSchema).safeParse(value);
      return result.success
        ? result.data.map(item => makeMovement('', item.owner, item.amount, item.token_id, true))
        : [];
    }
    if (entrypoint === 'transfer') {
      const result = transfersSchema.safeParse(value);
      return result.success
        ? result.data.flatMap(item =>
            item.txs.map(tx => makeMovement(item.from_, tx.to_, tx.amount, tx.token_id, false))
          )
        : [];
    }
    return [];
  });
}

/** Atomic quantities become display units exactly once, only with validated decimals. */
export function purchaseDisplayAmount(atomicAmount: string, decimals: number | undefined): string | undefined {
  if (decimals === undefined || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 255) return undefined;
  return new BigNumber(atomicAmount).shiftedBy(-decimals).toFixed();
}

/** Keep the authoritative buyer debit, adding mints and actual incoming refunds without recounting payment children. */
export function buildPurchaseDiffs(
  movements: PurchaseMovement[],
  address: string,
  decimals: Readonly<Record<string, number>>,
  payment: HistoryDisplayMoneyDiff[] | undefined
): HistoryDisplayMoneyDiff[] {
  const totals = new Map<string, BigNumber>();
  const unavailable = new Set<string>();
  for (const diff of payment ?? []) totals.set(diff.assetSlug, new BigNumber(diff.diff));
  for (const movement of movements) {
    const isIncoming = movement.to === address;
    const isOutgoing = movement.from === address;
    if (!isIncoming && !isOutgoing) continue;
    // The parent's debit already includes all outgoing legs of this payment asset.
    if (!movement.isMint && isOutgoing && payment?.some(diff => diff.assetSlug === movement.assetSlug)) continue;
    const amount = purchaseDisplayAmount(movement.atomicAmount, decimals[movement.assetSlug]);
    if (amount === undefined) {
      unavailable.add(movement.assetSlug);
      continue;
    }
    const signed = new BigNumber(amount).times(Number(isIncoming) - Number(isOutgoing));
    totals.set(movement.assetSlug, (totals.get(movement.assetSlug) ?? new BigNumber(0)).plus(signed));
  }
  return [...totals]
    .filter(([slug, amount]) => !unavailable.has(slug) && !amount.isZero())
    .map(([assetSlug, amount]) => ({ assetSlug, diff: amount.toFixed() }));
}
