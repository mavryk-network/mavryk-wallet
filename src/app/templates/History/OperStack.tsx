import React, { memo } from 'react';

import classNames from 'clsx';

import { IndividualHistoryItem, UserHistoryItem } from 'lib/temple/history/types';

import { OpertionStackItem } from './OperStackItem';

interface Props {
  base: IndividualHistoryItem[];
  className?: string;
  historyItem?: UserHistoryItem;
}

export const OperationStack = memo<Props>(({ base, className, historyItem }) => {
  return (
    <div className={classNames('flex flex-col', className)}>
      {base.map((item, i) => (
        <div key={i}>
          <OpertionStackItem originalHistoryItem={historyItem} item={item} />
        </div>
      ))}
    </div>
  );
});
