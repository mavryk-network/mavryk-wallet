import React, { memo, useMemo } from 'react';

import clsx from 'clsx';

import { T } from 'lib/i18n';
import { HISTORY_ACTION_LABELS, isSupportedHistoryAction, summarizeHistoryActions } from 'lib/temple/history/actions';
import type { UserHistoryItem } from 'lib/temple/history/types';

export const GaslessTag = memo<{ className?: string }>(({ className }) => (
  <span className={clsx('px-1.5 py-px rounded border border-accent-blue text-accent-blue text-xs', className)}>
    <T id="gasless" />
  </span>
));

/** Compact row label built from supported actions, e.g. `BUY order placed #1321` or `Order refund ×3`. */
export const HistoryActionsLabel = memo<{ historyItem: UserHistoryItem }>(({ historyItem }) => {
  const summaries = useMemo(() => summarizeHistoryActions(historyItem.actions), [historyItem.actions]);

  if (!summaries.length) return null;

  return (
    <div className="flex items-center flex-wrap gap-x-1 text-white text-sm">
      {summaries.map((summary, i) => (
        <span key={summary.kind}>
          {summary.label}
          {summary.count > 1 && ` ×${summary.count}`}
          {summary.orderId && <span className="text-secondary-white"> #{summary.orderId}</span>}
          {i < summaries.length - 1 && ','}
        </span>
      ))}
      {historyItem.isGasless && <GaslessTag />}
    </div>
  );
});

/** Popup card listing every supported action with its order ID and side; unsupported kinds are omitted. */
export const HistoryActionsList = memo<{ historyItem: UserHistoryItem }>(({ historyItem }) => {
  const actions = useMemo(() => (historyItem.actions ?? []).filter(isSupportedHistoryAction), [historyItem.actions]);

  if (!actions.length) return null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="text-base-plus">
        <T id="historyActions" />
      </div>
      {actions.map(action => (
        <div key={action.id} className="flex items-center justify-between gap-2">
          <span>{HISTORY_ACTION_LABELS[action.kind]}</span>
          <span className="text-secondary-white">
            {action.orderId ? <T id="orderNumber" substitutions={[action.orderId]} /> : action.launch}
            {action.orderSide && ` · ${action.orderSide.toUpperCase()}`}
          </span>
        </div>
      ))}
    </div>
  );
});
