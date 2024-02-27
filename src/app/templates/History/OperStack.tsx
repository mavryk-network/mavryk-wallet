import React, { memo, useMemo, useState } from 'react';

import classNames from 'clsx';

import { ListItemDivider } from 'app/atoms/Divider';
import { OP_STACK_PREVIEW_SIZE } from 'app/defaults';
import { T } from 'lib/i18n/react';
import { IndividualHistoryItem } from 'lib/temple/history/types';

import { OpertionStackItem } from './OperStackItem';

interface Props {
  operStack: IndividualHistoryItem[];
  className?: string;
}

export const OperationStack = memo<Props>(({ operStack, className }) => {
  const [expanded, setExpanded] = useState(false);

  const base = useMemo(() => operStack.filter((_, i) => i < OP_STACK_PREVIEW_SIZE), [operStack]);
  const rest = useMemo(() => operStack.filter((_, i) => i >= OP_STACK_PREVIEW_SIZE), [operStack]);

  return (
    <div className={classNames('flex flex-col', className)}>
      {base.map((item, i) => (
        <div key={i}>
          <OpertionStackItem item={item} />
        </div>
      ))}

      {rest.length > 0 && (
        <div className={classNames('flex items-center', expanded && 'mt-1')}>
          <button
            className={classNames('flex items-center', 'text-blue-600 opacity-75 hover:underline', 'leading-none')}
            onClick={() => setExpanded(e => !e)}
          >
            <T id={expanded ? 'less' : 'more'} />
          </button>
        </div>
      )}

      {expanded && (
        <div className="p-4 bg-primary-bg flex flex-col rounded-2xl-plus">
          {rest.map((item, i) => (
            <div key={i}>
              <OpertionStackItem item={item} isTiny />
              <ListItemDivider />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

type TransactionIconType = {
  slug: string | undefined;
  onClick: () => void;
};
