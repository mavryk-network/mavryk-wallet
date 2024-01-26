import React, { memo } from 'react';

import TabSwitcherItem, { TabSwitcherItemProps } from './TabSwitcherItem';

export interface TabsSwitcherProps {
  activeItem: TabSwitcherItemProps;
  items: TabSwitcherItemProps[];
  onChange: (item: TabSwitcherItemProps) => void;
}

const TabsSwitcher = memo(({ activeItem, items, onChange }: TabsSwitcherProps) => (
  <div className="flex items-center gap-4">
    {items.map(item => (
      <TabSwitcherItem key={item.key} currentItem={item} activeItem={activeItem} onChange={onChange} />
    ))}
  </div>
));

export default TabsSwitcher;
