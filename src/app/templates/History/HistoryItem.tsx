import React, { useMemo, memo, useState } from 'react';

import classNames from 'clsx';

import { ListItemDivider } from 'app/atoms/Divider';
import { OP_STACK_PREVIEW_SIZE } from 'app/defaults';
import { T } from 'lib/i18n';
import { UserHistoryItem } from 'lib/temple/history';
import { buildHistoryMoneyDiffs, buildHistoryOperStack, isZero } from 'lib/temple/history/helpers';
import { HistoryItemOpTypeEnum } from 'lib/temple/history/types';

import styles from './history.module.css';
import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { MoneyDiffView } from './MoneyDiffView';
import { OperationStack } from './OperStack';
import { OpertionStackItem } from './OperStackItem';
import { getMoneyDiffForMultiple, getMoneyDiffsForSwap } from './utils';

interface Props {
  historyItem: UserHistoryItem;
  address: string;
  last?: boolean;
  slug?: string;
  handleItemClick: (hash: string) => void;
}

export const HistoryItem = memo<Props>(({ historyItem, last, handleItemClick }) => {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { hash, addedAt, status } = historyItem;

  const operStack = useMemo(() => buildHistoryOperStack(historyItem), [historyItem]);

  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem, true), [historyItem]);

  const base = useMemo(
    () => operStack.filter((_, i) => i < OP_STACK_PREVIEW_SIZE).map(op => ({ ...op, type: Number(historyItem.type) })),
    [historyItem.type, operStack]
  );

  const isSwapOperation = historyItem.type === HistoryItemOpTypeEnum.Swap;
  const isInteractionOperation = historyItem.type === HistoryItemOpTypeEnum.Multiple;

  const rest = useMemo(
    () => (isSwapOperation ? operStack : operStack.filter((_, i) => i >= OP_STACK_PREVIEW_SIZE)),
    [isSwapOperation, operStack]
  );

  const moneyDiffsBase = useMemo(
    () =>
      isSwapOperation
        ? getMoneyDiffsForSwap(moneyDiffs)
        : isInteractionOperation
        ? getMoneyDiffForMultiple(moneyDiffs)
        : moneyDiffs.filter((_, i) => i < OP_STACK_PREVIEW_SIZE),
    [isInteractionOperation, isSwapOperation, moneyDiffs]
  );
  const moneyDiffsRest = useMemo(
    () => (isSwapOperation ? moneyDiffs : moneyDiffs.filter((_, i) => i >= OP_STACK_PREVIEW_SIZE)),
    [moneyDiffs, isSwapOperation]
  );

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
            <div className="flex items-start gap-x-1">
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

        <div className="flex flex-col justify-center items-end gap-1" style={{ maxWidth: 76 }}>
          {moneyDiffsBase.map(({ assetSlug, diff }, i) => {
            if (isZero(diff)) return null;
            return (
              <MoneyDiffView
                key={i}
                className="gap-1"
                assetId={assetSlug}
                diff={diff}
                pending={status === 'pending'}
                showFiatBalance={!isSwapOperation && !isInteractionOperation}
              />
            );
          })}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pt-2 pb-2 mt-3 bg-gray-910 flex flex-col rounded-2xl-plus">
          {rest.map((item, i, arr) => (
            <div key={i}>
              <OpertionStackItem item={item} moneyDiff={moneyDiffsRest[i]} last={arr.length - 1 === i} isTiny />
            </div>
          ))}
        </div>
      )}
      {!last && !isHovered && <ListItemDivider className={styles.divider} />}
    </div>
  );
});
