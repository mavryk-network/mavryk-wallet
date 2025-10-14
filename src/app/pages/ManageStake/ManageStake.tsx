import React, { FC, useMemo } from 'react';

import clsx from 'clsx';

import { useTabSlug } from 'app/atoms/useTabSlug';
import { useAppEnv } from 'app/env';
import ContentContainer from 'app/layouts/ContentContainer';
import PageLayout from 'app/layouts/PageLayout';
import { TabsBar } from 'app/templates/TabBar';
import { T, TID } from 'lib/i18n';

import styles from './manageStake.module.css';
import { ManageStakeSelectors } from './manageStake.selectors';
import { DecreaseStake } from './screens/DecreaseStake';
import { IncreaseStake } from './screens/IncreaseStake';

type TabName = 'stake' | 'unlock';
interface TabData {
  name: TabName;
  titleI18nKey: TID;
  Component: FC;
  testID: string;
  disabled?: boolean;
}

export const ManageStake: FC = () => {
  const { popup, fullPage } = useAppEnv();
  const tabSlug = useTabSlug();

  const tabs = useMemo<TabData[]>(() => {
    return [
      {
        name: 'stake',
        titleI18nKey: 'increaseCostake',
        Component: IncreaseStake,
        testID: ManageStakeSelectors.increaseStake
      },
      {
        name: 'unlock',
        titleI18nKey: 'decreaseCostake',
        Component: DecreaseStake,
        testID: ManageStakeSelectors.decreaseStake
      }
    ];
  }, []);

  const { name, Component } = useMemo(() => {
    const tab = tabSlug ? tabs.find(currentTab => currentTab.name === tabSlug) : null;
    return tab ?? tabs[0];
  }, [tabSlug, tabs]);

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<T id="manageYourCoStake" />} removePaddings={popup}>
      <ContentContainer className={clsx('h-full flex-1 flex flex-col text-white', !fullPage && 'pb-8 pt-4')}>
        <p className="text-sm font-normal text-white mb-6">
          Co-stake all, or a portion of your $MVRK. You can choose to increase or decrease your co-stake at any time.
        </p>
        <div className="flex items-center relative">
          <TabsBar tabs={tabs} activeTabName={name} tabContainerClassName={styles.tabContainerClassName} />
        </div>

        {Component && <Component />}
      </ContentContainer>
    </PageLayout>
  );
};
