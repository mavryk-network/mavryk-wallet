import BigNumber from 'bignumber.js';

import { MAV_TOKEN_SLUG } from 'lib/assets';
import type {
  MavrykHistoryNetworkFees,
  MavrykHistoryOperation,
  MavrykHistoryOperationDetails
} from 'mavryk/api/history';

import { getPurchaseMovements, purchaseDisplayAmount } from './purchase';
import type { HistoryDisplayMoneyDiff } from './types';

/** Identify API movement details without changing purchase allocation accounting. */
export const hasHistoryMovement = (details?: MavrykHistoryOperationDetails | null) =>
  details?.entrypoint !== 'purchase' &&
  Boolean(
    (details?.tokenAddress && (details.amount != null || details.type === 'transfer')) ||
      (details?.currency && details.type === 'transfer') ||
      details?.movementKind ||
      details?.transfers ||
      details?.partialTransfers
  );

/** Keep API display units and unknown values; a missing token ID is never token zero. */
export function getHistoryMovementDiff(
  details: MavrykHistoryOperationDetails,
  address: string
): HistoryDisplayMoneyDiff {
  const isNative = ['MVRK', 'MAV'].includes(details.currency?.toUpperCase() ?? '');
  const assetSlug = isNative
    ? MAV_TOKEN_SLUG
    : `${details.tokenAddress ?? ''}${details.tokenId == null ? '' : `_${details.tokenId}`}`;
  const amount = details.amount == null ? undefined : new BigNumber(details.amount);
  const isSent = details.transferType === 'sent' || (!details.transferType && details.from === address);
  return {
    assetSlug,
    symbol: details.currency || details.tokenAddress || '—',
    diff:
      amount
        ?.abs()
        .times(isSent ? -1 : 1)
        .toFixed() ?? 'NaN',
    usdAmount: details.usdAmount == null ? null : Number(details.usdAmount),
    isNeutral: details.transferType === 'self',
    isAmountUnavailable: amount === undefined,
    ...(amount === undefined ? { isNegative: isSent } : {})
  };
}

/** Replace represented raw token legs with API movements, retaining unmatched and native operations. */
export function expandHistoryMovements(
  parent: MavrykHistoryOperation,
  children: MavrykHistoryOperation[],
  decimals: Readonly<Record<string, number>> = {}
) {
  const transfers = parent.details?.transfers ?? [];
  if (!transfers.length && !parent.details?.partialTransfers) return children;
  const remaining = transfers.map(details => ({ ...details }));
  const retained = children.flatMap(operation => {
    if (operation === parent) return [];
    const rawMovements = getPurchaseMovements([operation]);
    const candidates: MavrykHistoryOperationDetails[] = rawMovements.length
      ? rawMovements.map(movement => ({
          tokenAddress: movement.contract,
          tokenId: movement.tokenId,
          from: movement.from || undefined,
          to: movement.to,
          rawAmount: movement.atomicAmount,
          amount: purchaseDisplayAmount(movement.atomicAmount, decimals[movement.assetSlug]),
          movementKind: movement.isMint ? ('mint' as const) : undefined
        }))
      : operation.details?.tokenAddress
      ? [operation.details]
      : [];
    if (!candidates.length) return [operation];
    const unmatched = candidates.filter(candidate => {
      const index = remaining.findIndex(
        movement =>
          movement.tokenAddress === candidate.tokenAddress &&
          String(movement.tokenId ?? '') === String(candidate.tokenId ?? '') &&
          movement.from === candidate.from &&
          movement.to === candidate.to &&
          (movement.rawAmount != null && candidate.rawAmount != null
            ? movement.rawAmount === candidate.rawAmount
            : movement.amount == null ||
              (candidate.amount != null && new BigNumber(movement.amount).eq(candidate.amount)))
      );
      if (index < 0) return true;
      remaining.splice(index, 1);
      return false;
    });
    if (unmatched.length === candidates.length && !rawMovements.length) return [operation];
    const result: MavrykHistoryOperation[] = unmatched.map(details => ({
      ...operation,
      details: { ...details, type: 'transfer', entrypoint: undefined },
      operations: undefined
    }));
    if (operation.amount && operation.amount > 0) {
      result.push({
        ...operation,
        parameter: undefined,
        details: {
          type: 'transfer',
          amount: operation.amount,
          currency: 'MVRK',
          from: operation.sender,
          to: operation.target
        }
      });
    }
    return result;
  });
  const operations = [
    ...transfers.map((details, index) => ({
      ...parent,
      id: index,
      amount: undefined,
      parameter: undefined,
      sender: undefined,
      target: undefined,
      networkFees: index === 0 ? parent.networkFees : undefined,
      operations: undefined,
      details: { ...details, type: 'transfer', entrypoint: undefined }
    })),
    ...retained
  ];
  const networkFees = parent.networkFees ?? sumMovementNetworkFees(children);
  // Splitting or removing represented token legs must neither duplicate nor lose their fees.
  return operations.map((operation, index) => ({ ...operation, networkFees: index === 0 ? networkFees : undefined }));
}

/** Preserve fees from raw operations when the API does not provide parent totals. */
function sumMovementNetworkFees(operations: MavrykHistoryOperation[]): MavrykHistoryNetworkFees | undefined {
  const fees = operations.flatMap(operation => (operation.networkFees ? [operation.networkFees] : []));
  if (!fees.length) return undefined;
  const sum = (key: keyof MavrykHistoryNetworkFees) =>
    fees.reduce((total, fee) => total.plus(fee[key] ?? 0), new BigNumber(0)).toNumber();
  return {
    totalFee: sum('totalFee'),
    gasFee: sum('gasFee'),
    storageFee: sum('storageFee'),
    burnedFromFees: sum('burnedFromFees'),
    usdAmount: fees.every(fee => fee.usdAmount != null) ? sum('usdAmount') : undefined
  };
}
