import React, { useEffect, useState, useMemo, memo } from 'react';

import classNames from 'clsx';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

import { ListItemDivider } from 'app/atoms/Divider';
import { MoneyDiffView } from 'app/templates/activity/MoneyDiffView';
import { getDateFnsLocale } from 'lib/i18n';
import { t } from 'lib/i18n/react';
import { AssetMetadataBase, useAssetMetadata } from 'lib/metadata';
import { UserHistoryItem } from 'lib/temple/history';
import { buildHistoryMoneyDiffs, buildHistoryOperStack } from 'lib/temple/history/helpers';

import { HistoryTime } from './HistoryTime';
import { HistoryTokenIcon } from './HistoryTokenIcon';
import { OperationStack } from './OperStack';

interface Props {
  historyItem: UserHistoryItem;
  address: string;
  last?: boolean;
  slug?: string;
  handleItemClick: (hash: string) => void;
}

// TODO cechk for token asset slug
const toTokenSlug = (contractAddress: string, tokenId: string | number = 0) =>
  contractAddress === 'tez' ? contractAddress : `${contractAddress}_${tokenId}`;

export const HistoryItem = memo<Props>(({ historyItem, address, last, slug, handleItemClick }) => {
  const assetSlug =
    slug || !historyItem.operations[0]?.contractAddress
      ? 'tez'
      : toTokenSlug(
          historyItem.operations[0].contractAddress ?? '',
          historyItem.operations[0]?.tokenTransfers?.tokenId
        );

  const tokenMetadata = useAssetMetadata(assetSlug);
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
            <HistoryTime addedAt={addedAt} />
            {/* <ActivityItemStatusComp activity={activity} /> */}
            {/* <HashChip hash={hash} firstCharsCount={10} lastCharsCount={7} small className="mr-2" /> */}
          </div>
        </div>

        <div className="flex flex-col justify-center items-end" style={{ maxWidth: 76 }}>
          {moneyDiffs.map(({ assetSlug, diff }, i) => (
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
