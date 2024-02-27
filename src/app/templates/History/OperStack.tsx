import React, { memo, useMemo, useState } from 'react';

import classNames from 'clsx';

import { ListItemDivider } from 'app/atoms/Divider';
import { OP_STACK_PREVIEW_SIZE } from 'app/defaults';
import { T, t } from 'lib/i18n/react';
import { useAssetMetadata } from 'lib/metadata';
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
          {/* TODO pick token metadata based on operation as well as op name */}
          {/* <TransactionIcon slug={item.tokenType} onClick={() => {}} /> */}
          <OpertionStackItem item={item} />s
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

const TransactionIcon: React.FC<TransactionIconType> = ({ slug, onClick }) => {
  const tokenMetadata = useAssetMetadata(slug ?? '');

  console.log(slug, 'slug');

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
