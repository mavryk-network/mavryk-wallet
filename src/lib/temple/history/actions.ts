import type { MavrykHistoryAction, MavrykHistoryOperation } from 'mavryk/api/history';

import type { HistoryNetworkFeePayer } from './types';

/** Action kinds with dedicated wallet labels; any other kind keeps the generic interaction rendering. */
export const SUPPORTED_HISTORY_ACTION_KINDS = [
  'place_buy_order',
  'place_sell_order',
  'cancel_order',
  'refund_order',
  'launchpad_purchase'
] as const;

export type SupportedHistoryActionKind = (typeof SUPPORTED_HISTORY_ACTION_KINDS)[number];

export const HISTORY_ACTION_LABELS: Record<SupportedHistoryActionKind, string> = {
  place_buy_order: 'BUY order placed',
  place_sell_order: 'SELL order placed',
  cancel_order: 'Order cancelled',
  refund_order: 'Order refund',
  launchpad_purchase: 'Launchpad purchase'
};

export const isSupportedHistoryAction = (
  action: MavrykHistoryAction
): action is MavrykHistoryAction & { kind: SupportedHistoryActionKind } =>
  (SUPPORTED_HISTORY_ACTION_KINDS as readonly string[]).includes(action.kind);

/** Keeps the first occurrence of each action ID, preserving API order. */
export const dedupeHistoryActions = (actions: MavrykHistoryAction[]) => {
  const seen = new Set<string>();

  return actions.filter(action => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
};

const isImplicitAddress = (address?: string) => Boolean(address) && !address!.startsWith('KT');

/**
 * Attributes the group's network fee only on complete evidence: every supported action names the same payer,
 * every implicit-account child operation was sent by that payer, and the child preview is not capped.
 * Contract (KT) children never pay fees themselves, so they are not counter-evidence.
 *
 * @returns `undefined` when there are no supported actions, so legacy rows keep their current fee display.
 */
export function deriveHistoryNetworkFeePayer(
  actions: MavrykHistoryAction[],
  childOperations: MavrykHistoryOperation[],
  operationsCount: number | undefined,
  walletAddress: string
): HistoryNetworkFeePayer | undefined {
  const supportedActions = actions.filter(isSupportedHistoryAction);
  if (!supportedActions.length) return undefined;

  const payers = new Set(supportedActions.map(action => action.networkFeePayer));
  const [payer] = payers;
  const isPreviewComplete = operationsCount === undefined || operationsCount <= childOperations.length;
  const isChildEvidenceConsistent = childOperations.every(
    operation => !isImplicitAddress(operation.sender) || operation.sender === payer
  );

  if (payers.size !== 1 || !payer || !isPreviewComplete || !isChildEvidenceConsistent) {
    return { kind: 'mixed' };
  }

  return payer === walletAddress ? { kind: 'wallet' } : { kind: 'other', address: payer };
}

export type HistoryActionSummary = {
  kind: SupportedHistoryActionKind;
  label: string;
  count: number;
  /** Present only when the group has exactly one action of this kind with an order ID. */
  orderId?: string;
};

/** Collapses supported actions by kind in first-seen order, e.g. three refunds become `Order refund ×3`. */
export function summarizeHistoryActions(actions: MavrykHistoryAction[] = []): HistoryActionSummary[] {
  const summaries = new Map<SupportedHistoryActionKind, HistoryActionSummary>();

  actions.filter(isSupportedHistoryAction).forEach(action => {
    const summary = summaries.get(action.kind);

    if (summary) {
      summary.count += 1;
      summary.orderId = undefined;
      return;
    }

    summaries.set(action.kind, {
      kind: action.kind,
      label: HISTORY_ACTION_LABELS[action.kind],
      count: 1,
      orderId: action.orderId
    });
  });

  return [...summaries.values()];
}
