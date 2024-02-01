import React, { FC } from 'react';

import classNames from 'clsx';

import { T, TID } from 'lib/i18n';

export type BakerTableData = {
  i18nKey: TID;
  child: JSX.Element;
};

type BakerTableProps = {
  data: BakerTableData[];
};

export const BakerTable: FC<BakerTableProps> = ({ data }) => {
  return (
    <div className="flex flex-wrap items-center w-full">
      {data.map(item => (
        <BakerTableItem key={item.i18nKey} item={item} />
      ))}
    </div>
  );
};

type BakerTableItemProps = {
  item: BakerTableData;
};

const BakerTableItem: FC<BakerTableItemProps> = ({ item }) => {
  return (
    <div className={classNames('flex items-start', 'mr-6')}>
      <div className={classNames('text-xs leading-tight flex', 'text-secondary-white flex-col', 'items-start flex-1')}>
        <T id={item.i18nKey} />
        <span className="mt-1 text-white flex">{item.child}</span>
      </div>
    </div>
  );
};
