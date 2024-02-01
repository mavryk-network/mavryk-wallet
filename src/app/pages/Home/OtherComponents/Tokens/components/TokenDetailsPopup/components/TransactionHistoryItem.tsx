import React, { useEffect, useState, useMemo, memo } from 'react';

import classNames from 'clsx';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

import { HashChip } from 'app/atoms';
import { ListItemDivider } from 'app/atoms/Divider';
import { MoneyDiffView } from 'app/templates/activity/MoneyDiffView';
import { OperationStack, OperStack } from 'app/templates/activity/OperStack';
import { OpenInExplorerChip } from 'app/templates/OpenInExplorerChip';
import { getDateFnsLocale } from 'lib/i18n';
import { t } from 'lib/i18n/react';
import { AssetMetadataBase, useAssetMetadata } from 'lib/metadata';
import { Activity, buildOperStack, buildMoneyDiffs } from 'lib/temple/activity-new';

interface Props {
  activity: Activity;
  address: string;
  last?: boolean;
  slug?: string;
  handleItemClick: (hash: string) => void;
}

export const TransactionHistoryItem = memo<Props>(({ activity, address, last, slug, handleItemClick }) => {
  const tokenMetadata = useAssetMetadata(slug ?? '');
  const { hash, addedAt, status } = activity;

  const operStack = useMemo(() => buildOperStack(activity, address), [activity, address]);
  const moneyDiffs = useMemo(() => buildMoneyDiffs(activity), [activity]);

  return (
    <div className={classNames('py-3 px-4 hover:bg-primary-card-hover relative cursor-pointer')}>
      <div className="flex items-center justify-between">
        <div className="flex -tems-center gap-3">
          <TransactionIcon tokenMetadata={tokenMetadata} onClick={() => handleItemClick(hash)} />
          <div className="flex flex-col gap-1 items-start justify-center">
            <OperationStack operStack={operStack} />
            <Time
              children={() => (
                <span className="text-sm text-secondary-white">
                  {formatDistanceToNow(new Date(addedAt), {
                    includeSeconds: true,
                    addSuffix: true,
                    locale: getDateFnsLocale()
                  })}
                </span>
              )}
            />
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

type TransactionIconType = {
  tokenMetadata: AssetMetadataBase | undefined;
  onClick: () => void;
};

const TransactionIcon: React.FC<TransactionIconType> = ({ tokenMetadata, onClick }) => {
  return (
    <div className="w-11 h-11 bg-transparent rounded-full flex items-center justify-center" onClick={onClick}>
      {tokenMetadata?.thumbnailUri ? (
        <img className="rounded-full w-8 h-8" src={tokenMetadata?.thumbnailUri} alt={tokenMetadata?.name} />
      ) : (
        <div className="text-white text-xs">{tokenMetadata?.name ?? t('unknown')}</div>
      )}
    </div>
  );
};

interface ActivityItemStatusCompProps {
  activity: Activity;
}

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

type TimeProps = {
  children: () => React.ReactElement;
};

const Time: React.FC<TimeProps> = ({ children }) => {
  const [value, setValue] = useState(children);

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(children());
    }, 5_000);

    return () => {
      clearInterval(interval);
    };
  }, [setValue, children]);

  return value;
};
