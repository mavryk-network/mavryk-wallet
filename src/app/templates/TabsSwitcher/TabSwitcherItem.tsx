import React, { FC, FunctionComponent, SVGProps } from 'react';

import classNames from 'clsx';

import { Button } from 'app/atoms/Button';
import { TestIDProperty } from 'lib/analytics';

import styles from '../TabBar/TabBar.module.css';

export interface TabSwitcherItemProps extends TestIDProperty {
  Icon: FunctionComponent<SVGProps<SVGSVGElement>>;
  key: string;
  name: string;
}

interface Props {
  currentItem: TabSwitcherItemProps;
  activeItem: TabSwitcherItemProps;
  onChange: (item: TabSwitcherItemProps) => void;
}

const TabSwitcherItem: FC<Props> = ({ currentItem, activeItem, onChange }) => {
  // const first = currentItemIndex === 0;
  // const last = currentItemIndex === totalItemsLength - 1;
  // const selected = activeItem.key === currentItem.key;
  const handleClick = () => onChange(currentItem);

  return (
    <Button
      className={classNames(
        'flex text-center cursor-pointer pb-2',
        'text-base-plus truncate',
        'transition ease-in-out duration-300',
        activeItem.name === currentItem.name ? classNames('text-white', styles.tab) : 'text-secondary-white'
      )}
      onClick={handleClick}
      testID={currentItem.testID}
    >
      <span className="truncate">{currentItem.name}</span>
    </Button>
  );
};

export default TabSwitcherItem;
