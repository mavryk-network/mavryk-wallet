import React, { useEffect, useState, useMemo, memo } from 'react';

import classNames from 'clsx';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

import { HashChip } from 'app/atoms';
import { MoneyDiffView } from 'app/templates/activity/MoneyDiffView';
import { OpenInExplorerChip } from 'app/templates/OpenInExplorerChip';
import { getDateFnsLocale } from 'lib/i18n';
import { t } from 'lib/i18n/react';
import { UserHistoryItem } from 'lib/temple/history';
import { buildHistoryMoneyDiffs, buildHistoryOperStack } from 'lib/temple/history/helpers';

import { OperStack } from './OperStack';

interface Props {
  historyItem: UserHistoryItem;
  address: string;
}

export const HistoryItem = memo<Props>(({ historyItem, address }) => {
  const { hash, addedAt, status } = historyItem;

  const operStack = useMemo(() => buildHistoryOperStack(historyItem), [historyItem]);
  const moneyDiffs = useMemo(() => buildHistoryMoneyDiffs(historyItem), [historyItem]);

  return (
    <div className={classNames('my-3')}>
      <div className="w-full flex items-center">
        <HashChip hash={hash} firstCharsCount={10} lastCharsCount={7} small className="mr-2" />

        <OpenInExplorerChip hash={hash} className="mr-2" small />

        <div className={classNames('flex-1', 'h-px', 'bg-gray-200')} />
      </div>

      <div className="flex items-stretch">
        <div className="flex flex-col pt-2">
          <OperStack operStack={operStack} className="mb-2" />

          <HistoryItemStatusComp historyItem={historyItem} />

          <Time
            children={() => (
              <span className="text-xs font-light text-gray-500">
                {formatDistanceToNow(new Date(addedAt), {
                  includeSeconds: true,
                  addSuffix: true,
                  locale: getDateFnsLocale()
                })}
              </span>
            )}
          />
        </div>

        <div className="flex-1" />

        {/* <div className="flex flex-col flex-shrink-0 pt-2">
          {moneyDiffs.map(({ assetSlug, diff }, i) => (
            <MoneyDiffView key={i} assetId={assetSlug} diff={diff} pending={status === 'pending'} />
          ))}
        </div> */}
      </div>
    </div>
  );
});

interface ActivityItemStatusCompProps {
  historyItem: UserHistoryItem;
}

const HistoryItemStatusComp: React.FC<ActivityItemStatusCompProps> = ({ historyItem }) => {
  const explorerStatus = historyItem.status;
  const content = explorerStatus ?? 'pending';
  const conditionalTextColor = explorerStatus ? 'text-red-600' : 'text-yellow-600';

  return (
    <div className="mb-px text-xs font-light leading-none">
      <span className={classNames(explorerStatus === 'applied' ? 'text-gray-600' : conditionalTextColor, 'capitalize')}>
        {t(content) || content}
      </span>
    </div>
  );
};

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
