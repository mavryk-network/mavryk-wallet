import React, { useMemo, memo, useState } from 'react';

import classNames from 'clsx';

import { ListItemDivider } from 'app/atoms/Divider';
import { OP_STACK_PREVIEW_MULTIPLE_SIZE, OP_STACK_PREVIEW_SIZE } from 'app/defaults';
import { T } from 'lib/i18n';
import { UserHistoryItem } from 'lib/temple/history';
import { buildHistoryMoneyDiffs, buildHistoryOperStack, isZero, MoneyDiff } from 'lib/temple/history/helpers';
import { HistoryItemOpTypeEnum } from 'lib/temple/history/types';

import styles from './history.module.css';
import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { MoneyDiffView } from './MoneyDiffView';
import { OpertionStackItem } from './OperStackItem';
import { deriveStatusColorClassName, getMoneyDiffForMultiple, getMoneyDiffsForSwap } from './utils';

interface Props {
  historyItem: UserHistoryItem;
  address: string;
  last?: boolean;
  slug?: string;
  handleItemClick: (hash: string) => void;
}

export const HistoryItem = memo<Props>(({ historyItem, last, handleItemClick, address }) => {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { hash, addedAt, status } = historyItem;

  const isSwapOperation = historyItem.type === HistoryItemOpTypeEnum.Swap;
  const isInteractionOperation =
    historyItem.type === HistoryItemOpTypeEnum.Multiple || historyItem.type === HistoryItemOpTypeEnum.Interaction;

  const operStack = useMemo(() => buildHistoryOperStack(historyItem), [historyItem]);

  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem, true), [historyItem]);

  const base = useMemo(
    () =>
      operStack
        .filter((_, i) => i < OP_STACK_PREVIEW_SIZE)
        .map(op => ({
          ...op,
          type: Number(historyItem.type)
        })),
    [historyItem.type, operStack]
  );

  const rest = useMemo(
    () => (isSwapOperation ? operStack : operStack.filter((_, i) => i >= OP_STACK_PREVIEW_SIZE)),
    [isSwapOperation, operStack]
  );

  const moneyDiffsBase = useMemo(
    () =>
      isSwapOperation
        ? getMoneyDiffsForSwap(moneyDiffs)
        : isInteractionOperation
        ? getMoneyDiffForMultiple(moneyDiffs, OP_STACK_PREVIEW_MULTIPLE_SIZE)
        : moneyDiffs.filter((_, i) => i < OP_STACK_PREVIEW_SIZE),
    [isInteractionOperation, isSwapOperation, moneyDiffs]
  );

  // 0 to show all operations
  const moneyDiffsRest = useMemo(
    () => (isSwapOperation ? moneyDiffs : moneyDiffs.slice(1)),
    [moneyDiffs, isSwapOperation]
  );

  const filteredMoneyDiffBase = useMemo(
    () =>
      moneyDiffsBase.reduce<MoneyDiff[]>((acc, item) => {
        if (!isZero(item.diff)) acc.push(item);
        return acc;
      }, []),
    [moneyDiffsBase]
  );

  const [statusToShow, statusTextColor, statusBorderColor] = useMemo(
    () => deriveStatusColorClassName(status),
    [status]
  );

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={classNames(
        'py-2 px-4 relative cursor-pointer overflow-hidden',
        styles.historyItem,
        !expanded && 'hover:bg-primary-card-hover'
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => handleItemClick(hash)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleItemClick(hash);
          }
        }}
        className="flex items-start justify-between gap-2"
      >
        <div className="flex items-start gap-2 min-w-0">
          <HistoryTokenIcon historyItem={historyItem} size={24} />
          <div className="flex flex-col gap-0.5 min-w-0">
            {base.map((op, i) => (
              <OpertionStackItem key={i} originalHistoryItem={historyItem} item={op} userAddress={address} />
            ))}

            <div className="flex items-center gap-x-2 flex-wrap">
              <HistoryTime addedAt={addedAt || historyItem.operations[0].addedAt} />
              {rest.length > 0 && (
                <button
                  className="text-accent-blue hover:underline text-xs whitespace-nowrap"
                  onClick={e => {
                    e.stopPropagation();
                    setExpanded(e => !e);
                  }}
                >
                  <T id={expanded ? 'showLess' : 'showMore'} />
                </button>
              )}
            </div>

            {statusToShow && (
              <div className={classNames('capitalize text-xs text-secondary-white flex items-center gap-1')}>
                <span>Status: </span>
                <span className={classNames('px-1.5 py-px rounded border text-xs', statusTextColor, statusBorderColor)}>
                  {statusToShow}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-center items-end gap-0.5 shrink-0">
          {filteredMoneyDiffBase.map(({ assetSlug, diff }, i) => {
            return (
              <MoneyDiffView
                key={i}
                className="gap-0.5 flex-col"
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
              <OpertionStackItem
                item={item}
                moneyDiff={moneyDiffsRest[i]}
                last={arr.length - 1 === i}
                userAddress={address}
                isTiny
              />
            </div>
          ))}
        </div>
      )}
      {!last && !isHovered && <ListItemDivider className={styles.divider} />}
    </div>
  );
});
