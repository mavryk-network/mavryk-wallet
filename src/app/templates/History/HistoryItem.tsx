import React, { memo, useEffect, useMemo, useState } from 'react';

import classNames from 'clsx';
import formatDistanceToNow from 'date-fns/formatDistanceToNow';

import { getDateFnsLocale } from 'lib/i18n';
import { t } from 'lib/i18n/react';
import { buildMoneyDiffs, buildOperStack } from 'lib/temple/activity-new';
import { IndividualHistoryItem, UserHistoryItem } from 'lib/temple/history/types';

interface Props {
  historyItem: UserHistoryItem;
  address: string;
}

export const HistoryItem = memo<Props>(({ historyItem, address }) => {
  const {
    hash,
    addedAt,
    status,
    type,
    operations,
    firstOperation,
    isGroupedOp,
    oldestOperation,
    highlightedOperationIndex
  } = historyItem;
  const [showMore, setShowMore] = useState(false);

  const toggleShowMore = () => setShowMore(!showMore);

  // console.log(historyItem);
  const operStack = useMemo(() => buildOperStack(historyItem, address), [historyItem, address]);
  const moneyDiffs = useMemo(() => buildMoneyDiffs(historyItem), [historyItem]);

  return (
    <div>
      <div className={classNames('my-3', 'flex justify-between')}>
        <div className="flex">
          <SVGRenderer type={type} />
          <OpTextInfo
            firstOperation={firstOperation}
            isGroupedOp={isGroupedOp}
            addedAt={addedAt}
            toggleShowMore={toggleShowMore}
            showMore={showMore}
          />
        </div>
        {/*<CurrencyDisplay data={data} />*/}

        {/*<div>{historyItem.hash}</div>*/}
        {/*<div className="w-full flex items-center">*/}
        {/*  <HashChip hash={hash} firstCharsCount={10} lastCharsCount={7} small className="mr-2" />*/}

        {/*  <OpenInExplorerChip hash={hash} className="mr-2" small />*/}

        {/*  <div className={classNames('flex-1', 'h-px', 'bg-gray-200')} />*/}
        {/*</div>*/}

        {/*<div className="flex items-stretch">*/}
        {/*  <div className="flex flex-col pt-2">*/}
        {/*    /!*<OperStack operStack={operStack} className="mb-2" />*!/*/}

        {/*    <UserHistoryItemStatusComp activity={historyItem} />*/}

        {/*  <div className="flex-1" />*/}

        {/*<div className="flex flex-col flex-shrink-0 pt-2">*/}
        {/*  {moneyDiffs.map(({ assetSlug, diff }, i) => (*/}
        {/*    <MoneyDiffView key={i} assetId={assetSlug} diff={diff} pending={status === 'pending'} />*/}
        {/*  ))}*/}
        {/*</div>*/}
      </div>
      {showMore && <ExpandedOperations operations={operations} />}
    </div>
  );
});

interface UserHistoryItemStatusCompProps {
  activity: UserHistoryItem;
}

interface OpTextInfoProps {
  firstOperation: IndividualHistoryItem;
  isGroupedOp: boolean;
  addedAt: string;
  toggleShowMore?: () => void;
  showMore?: boolean;
}

const OpTextInfo: React.FC<OpTextInfoProps> = ({ firstOperation, isGroupedOp, addedAt, toggleShowMore, showMore }) => {
  return (
    <div>
      <div className="text-base text-primary-white">{firstOperation.hash}</div>
      <Time
        children={() => (
          <span className="text-sm font-light text-gray-30">
            {formatDistanceToNow(new Date(addedAt), {
              includeSeconds: true,
              addSuffix: true,
              locale: getDateFnsLocale()
            })}
          </span>
        )}
      />
      {isGroupedOp && <button onClick={toggleShowMore}>{showMore ? 'Show Less' : 'Show More'}</button>}
    </div>
  );
};

const UserHistoryItemStatusComp: React.FC<UserHistoryItemStatusCompProps> = ({ activity }) => {
  const explorerStatus = activity.status;
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

const SVGRenderer: React.FC<{ type: number }> = ({ type }) => {
  // SVG rendering logic based on the type
  return <div>SVGs here</div>;
};

const ExpandedOperations: React.FC<{ operations: Operation[] }> = ({ operations }) => {
  // Render additional information about operations
  return (
    <div>
      {operations.map(op => (
        <div key={op.id}>{/* Operation details */}</div>
      ))}
    </div>
  );
};
