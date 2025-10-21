import React, { FC } from 'react';

import clsx from 'clsx';

import { TestIDProps } from 'lib/analytics';
import { T, TID } from 'lib/i18n';
import { Link } from 'lib/woozie';

import styles from './TabBar.module.css';

interface Props {
  activeTabName: string;
  tabs: TabInterface[];
  withOutline?: boolean;
  tabContainerClassName?: string;
}

type TabInterface = Partial<TestIDProps> & {
  name: string;
  titleI18nKey: TID;
};

export const TabsBar = React.forwardRef<HTMLUListElement, Props>(
  ({ activeTabName, tabs, withOutline, tabContainerClassName = styles.tabbar }, ref) => (
    <nav className={clsx(styles.tabsNav, tabContainerClassName)}>
      <ul ref={ref} className={'w-full'}>
        {tabs.map(tab => (
          <li key={tab.name}>
            <TabButton active={tab.name === activeTabName} withOutline={withOutline} {...tab} />
          </li>
        ))}
      </ul>
    </nav>
  )
);

interface TabButtonProps extends TestIDProps {
  name: string;
  titleI18nKey: TID;
  active: boolean;
  withOutline?: boolean;
  disabled?: boolean;
}

const TabButton: FC<TabButtonProps> = ({ name, titleI18nKey, active, testID, testIDProperties, disabled = false }) => {
  const baseProps = {
    className: clsx(
      'text-center cursor-pointer',
      'text-base-plus truncate',
      active ? clsx('text-white', styles.active) : 'text-secondary-white hover:text-white',
      disabled && 'opacity-75 pointer-events-none'
    ),
    children: (
      <>
        <T id={titleI18nKey} />
      </>
    )
  };

  return (
    <Link
      to={lctn => ({ ...lctn, search: `?tab=${name}` })}
      replace
      {...baseProps}
      testID={testID}
      testIDProperties={testIDProperties}
    />
  );
};
