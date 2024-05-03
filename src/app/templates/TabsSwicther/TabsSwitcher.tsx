import React, { memo } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';

import TabSwitcherItem, { TabSwitcherItemProps } from './TabSwitcherItem';

export interface TabsSwitcherProps {
  activeItem: TabSwitcherItemProps;
  items: TabSwitcherItemProps[];
  onChange: (item: TabSwitcherItemProps) => void;
}

const TabsSwitcher = memo(({ activeItem, items, onChange }: TabsSwitcherProps) => {
  const { fullPage } = useAppEnv();

  return (
    <div className={clsx('flex items-center gap-4', fullPage && 'mb-3')}>
      {items.map(item => (
        <TabSwitcherItem key={item.key} currentItem={item} activeItem={activeItem} onChange={onChange} />
      ))}
    </div>
  );
});

export default TabsSwitcher;
