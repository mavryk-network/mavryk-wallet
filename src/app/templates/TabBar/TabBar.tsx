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
}

interface TabInterface extends TestIDProps {
  name: string;
  titleI18nKey: TID;
}

export const TabsBar = React.forwardRef<HTMLDivElement, Props>(({ activeTabName, tabs, withOutline }, ref) => (
  <div ref={ref} className={clsx('w-full gap-4 px-4', styles.tabbar)}>
    {tabs.map(tab => (
      <TabButton key={tab.name} active={tab.name === activeTabName} withOutline={withOutline} {...tab} />
    ))}
  </div>
));

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
      'flex1 w-full text-center cursor-pointer pb-2',
      'text-base-plus truncate',
      'transition ease-in-out duration-300',
      active ? clsx('text-white', styles.tab) : 'text-secondary-white',
      disabled && 'opacity-75 pointer-events-none'
    ),
    children: (
      <>
        <T id={titleI18nKey} />
      </>
    ),
    testID,
    testIDProperties
  };

  return disabled ? (
    <div {...baseProps} />
  ) : (
    <Link to={lctn => ({ ...lctn, search: `?tab=${name}` })} replace {...baseProps} />
  );
};
