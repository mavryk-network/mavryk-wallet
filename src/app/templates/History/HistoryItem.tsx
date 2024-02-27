import React, { useMemo, memo } from 'react';

import classNames from 'clsx';

import { ListItemDivider } from 'app/atoms/Divider';
import { MoneyDiffView } from 'app/templates/activity/MoneyDiffView';
import { UserHistoryItem } from 'lib/temple/history';
import { buildHistoryMoneyDiffs, buildHistoryOperStack } from 'lib/temple/history/helpers';

import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { OperationStack } from './OperStack';
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
  const assetSlug = toHistoryTokenSlug(historyItem, slug);

  const { hash, addedAt, status } = historyItem;

  const operStack = useMemo(() => buildHistoryOperStack(historyItem), [historyItem]);
  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem), [historyItem]);

  return (
    <div className={classNames('py-3 px-4 hover:bg-primary-card-hover relative cursor-pointer')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HistoryTokenIcon slug={assetSlug} onClick={() => handleItemClick(hash)} />
          <div className="flex flex-col gap-1 items-start justify-center">
            <OperationStack operStack={operStack} />
            <HistoryTime addedAt={addedAt || historyItem.operations[0].addedAt} />
          </div>
        </div>

        <div className="flex flex-col justify-center items-end" style={{ maxWidth: 76 }}>
          {moneyDiffs.slice(0, 1).map(({ assetSlug, diff }, i) => (
            <MoneyDiffView key={i} assetId={assetSlug} diff={diff} pending={status === 'pending'} />
          ))}
        </div>
      </div>
      {!last && <ListItemDivider />}
    </div>
  );
});

// interface ActivityItemStatusCompProps {
//   activity: Activity;
// }

// const ActivityItemStatusComp: React.FC<ActivityItemStatusCompProps> = ({ activity }) => {
//   const explorerStatus = activity.status;
//   const content = explorerStatus ?? 'pending';
//   const conditionalTextColor = explorerStatus ? 'text-red-600' : 'text-yellow-600';

//   return (
//     <div className="mb-px text-xs font-light leading-none">
//       <span className={classNames(explorerStatus === 'applied' ? 'text-gray-600' : conditionalTextColor, 'capitalize')}>
//         {t(content) || content}
//       </span>
//     </div>
//   );
// };
