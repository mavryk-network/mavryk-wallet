import React, { useMemo, memo, useState } from 'react';

import classNames from 'clsx';

import { ListItemDivider } from 'app/atoms/Divider';
import { OP_STACK_PREVIEW_SIZE } from 'app/defaults';
import { MoneyDiffView } from 'app/templates/activity/MoneyDiffView';
import { T } from 'lib/i18n';
import { UserHistoryItem } from 'lib/temple/history';
import { buildHistoryMoneyDiffs, buildHistoryOperStack, isZero } from 'lib/temple/history/helpers';

import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { OperationStack } from './OperStack';
import { OpertionStackItem } from './OperStackItem';
import { toHistoryTokenSlug } from './utils';

interface Props {
  historyItem: UserHistoryItem;
  address: string;
  last?: boolean;
  slug?: string;
  handleItemClick: (hash: string) => void;
}

// TODO cechk for token asset slug

export const HistoryItem = memo<Props>(({ historyItem, address, last, slug, handleItemClick }) => {
  const [expanded, setExpanded] = useState(false);
  const assetSlug = toHistoryTokenSlug(historyItem, slug);

  const { hash, addedAt, status } = historyItem;

  const operStack = useMemo(() => buildHistoryOperStack(historyItem), [historyItem]);
  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem, true), [historyItem]);

  const base = useMemo(() => operStack.filter((_, i) => i < OP_STACK_PREVIEW_SIZE), [operStack]);
  const rest = useMemo(() => operStack.filter((_, i) => i >= OP_STACK_PREVIEW_SIZE), [operStack]);

  const moneyDiffsBase = useMemo(() => moneyDiffs.filter((_, i) => i < OP_STACK_PREVIEW_SIZE), [moneyDiffs]);
  const moneyDiffsRest = useMemo(() => moneyDiffs.filter((_, i) => i >= OP_STACK_PREVIEW_SIZE), [moneyDiffs]);

  return (
    <div className={classNames('py-3 px-4 hover:bg-primary-card-hover relative cursor-pointer')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HistoryTokenIcon slug={assetSlug} onClick={() => handleItemClick(hash)} />
          <div className="flex flex-col gap-1 items-start justify-center">
            <OperationStack base={base} />
            <div className="flex items-center">
              <HistoryTime addedAt={addedAt || historyItem.operations[0].addedAt} />
              {rest.length > 0 && (
                <div className={classNames('flex items-center')}>
                  <button
                    className={classNames('flex items-center ml-1', 'text-accent-blue hover:underline')}
                    onClick={() => setExpanded(e => !e)}
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
            return <MoneyDiffView key={i} assetId={assetSlug} diff={diff} pending={status === 'pending'} />;
          })}
        </div>
      </div>
      {expanded && (
        <div className="p-4 mt-4 bg-primary-card flex flex-col rounded-2xl-plus">
          {rest.map((item, i) => (
            <div key={i}>
              <OpertionStackItem item={item} moneyDiff={moneyDiffsRest[i]} isTiny />
              <ListItemDivider />
            </div>
          ))}
        </div>
      )}
      {!last && <ListItemDivider />}
    </div>
  );
});
