import React, { useMemo, memo, useState } from 'react';

import classNames from 'clsx';

import { ListItemDivider } from 'app/atoms/Divider';
import { OP_STACK_PREVIEW_SIZE } from 'app/defaults';
import { MoneyDiffView } from 'app/templates/activity/MoneyDiffView';
import { T } from 'lib/i18n';
import { UserHistoryItem } from 'lib/temple/history';
import { buildHistoryMoneyDiffs, buildHistoryOperStack, isZero } from 'lib/temple/history/helpers';

import styles from './history.module.css';
import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { OperationStack } from './OperStack';
import { OpertionStackItem } from './OperStackItem';

interface Props {
  historyItem: UserHistoryItem;
  address: string;
  last?: boolean;
  slug?: string;
  handleItemClick: (hash: string) => void;
}

export const HistoryItem = memo<Props>(({ historyItem, address, last, slug, handleItemClick }) => {
  const [expanded, setExpanded] = useState(false);

  const { hash, addedAt, status } = historyItem;

  const operStack = useMemo(() => buildHistoryOperStack(historyItem), [historyItem]);
  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem, true), [historyItem]);

  const base = useMemo(
    () => operStack.filter((_, i) => i < OP_STACK_PREVIEW_SIZE).map(op => ({ ...op, type: Number(historyItem.type) })),
    [historyItem.type, operStack]
  );
  const rest = useMemo(() => operStack.filter((_, i) => i >= OP_STACK_PREVIEW_SIZE), [operStack]);

  const moneyDiffsBase = useMemo(() => moneyDiffs.filter((_, i) => i < OP_STACK_PREVIEW_SIZE), [moneyDiffs]);
  const moneyDiffsRest = useMemo(() => moneyDiffs.filter((_, i) => i >= OP_STACK_PREVIEW_SIZE), [moneyDiffs]);

  return (
    <div
      className={classNames(
        'py-3 px-4 relative cursor-pointer overflow-hidden',
        styles.historyItem,
        !expanded && 'hover:bg-primary-card-hover'
      )}
    >
      <div onClick={() => handleItemClick(hash)} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HistoryTokenIcon historyItem={historyItem} />
          <div className="flex flex-col gap-1 items-start justify-center">
            <OperationStack historyItem={historyItem} base={base} />
            <div className="flex items-center flex-wrap gap-1">
              <HistoryTime addedAt={addedAt || historyItem.operations[0].addedAt} />
              {rest.length > 0 && (
                <div className={classNames('flex items-center')}>
                  <button
                    className={classNames('flex items-center', 'text-accent-blue hover:underline')}
                    onClick={e => {
                      e.stopPropagation();
                      setExpanded(e => !e);
                    }}
                  >
                    <T id={expanded ? 'showLess' : 'showMore'} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center items-end" style={{ maxWidth: 76 }}>
          {moneyDiffsBase.map(({ assetSlug, diff }, i) => {
            if (isZero(diff)) return null;
            return (
              <MoneyDiffView key={i} className="gap-1" assetId={assetSlug} diff={diff} pending={status === 'pending'} />
            );
          })}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pt-2 pb-2 mt-3 bg-gray-910 flex flex-col rounded-2xl-plus">
          {rest.map((item, i) => (
            <div key={i}>
              <OpertionStackItem item={item} moneyDiff={moneyDiffsRest[i]} isTiny />
              <ListItemDivider />
            </div>
          ))}
        </div>
      )}
      {!last && <ListItemDivider className={styles.divider} />}
    </div>
  );
});
