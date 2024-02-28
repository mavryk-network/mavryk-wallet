import React, { memo } from 'react';

import classNames from 'clsx';

import { IndividualHistoryItem } from 'lib/temple/history/types';

import { OpertionStackItem } from './OperStackItem';

interface Props {
  base: IndividualHistoryItem[];
  className?: string;
}

export const OperationStack = memo<Props>(({ base, className }) => {
  return (
    <div className={classNames('flex flex-col', className)}>
      {base.map((item, i) => (
        <div key={i}>
          <OpertionStackItem item={item} />
        </div>
      ))}
    </div>
  );
});
