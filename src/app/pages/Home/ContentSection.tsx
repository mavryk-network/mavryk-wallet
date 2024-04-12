import React, { FC, ReactNode, Suspense, useCallback, useMemo, useRef } from 'react';

import clsx from 'clsx';

import Spinner from 'app/atoms/Spinner/Spinner';
import { useTabSlug } from 'app/atoms/useTabSlug';
import { useAppEnv } from 'app/env';
import ErrorBoundary from 'app/ErrorBoundary';
import { ToolbarElement } from 'app/layouts/PageLayout';
import { HistoryComponent } from 'app/templates/History/History';
import { TabsBar } from 'app/templates/TabBar/TabBar';
import { t, TID } from 'lib/i18n';

import { CollectiblesTab } from '../Collectibles/CollectiblesTab';

import { HomeSelectors } from './Home.selectors';
import { TokensTab } from './OtherComponents/Tokens/Tokens';

type Props = {
  assetSlug?: string | null;
  className?: string;
};

type TabName = 'tokens' | 'NFTs' | 'RWAs' | 'delegation' | 'info' | 'history';

interface TabData {
  name: TabName;
  titleI18nKey: TID;
  Component: FC;
  testID: string;
  whileMessageI18nKey?: TID;
  disabled?: boolean;
}

export const ContentSection: FC<Props> = ({ className }) => {
  const { fullPage } = useAppEnv();
  const tabSlug = useTabSlug();

  const tabBarElemRef = useRef<HTMLDivElement>(null);

  const scrollToTheTabsBar = useCallback(() => {
    if (!tabBarElemRef.current) return;

    const stickyBarHeight = ToolbarElement?.scrollHeight ?? 0;

    window.scrollTo({
      top: window.pageYOffset + tabBarElemRef.current.getBoundingClientRect().top - stickyBarHeight,
      behavior: 'smooth'
    });
  }, []);

  const tabs = useMemo<TabData[]>(() => {
    return [
      {
        name: 'tokens',
        titleI18nKey: 'tokens',
        Component: TokensTab,
        testID: HomeSelectors.assetsTab
      },
      {
        name: 'NFTs',
        titleI18nKey: 'NFTs',
        Component: () => <CollectiblesTab scrollToTheTabsBar={scrollToTheTabsBar} />,
        testID: HomeSelectors.NFTsTab
      },
      {
        name: 'history',
        titleI18nKey: 'history',
        Component: HistoryComponent,
        testID: HomeSelectors.activityTab,
        whileMessageI18nKey: 'operationHistoryWhileMessage'
      }
      // {
      //   name: 'RWAs',
      //   titleI18nKey: 'rwas',
      //   Component: HistoryComponent,
      //   testID: HomeSelectors.rwasTab,
      //   disabled: true
      // }
    ];
  }, [scrollToTheTabsBar]);

  const { name, Component, whileMessageI18nKey } = useMemo(() => {
    const tab = tabSlug ? tabs.find(currentTab => currentTab.name === tabSlug) : null;
    return tab ?? tabs[0];
  }, [tabSlug, tabs]);

  return (
    <div className={clsx('-mx-4 shadow-top-light h-full relative', fullPage && 'rounded-t-md', className)}>
      <div className="flex items-center relative">
        <TabsBar ref={tabBarElemRef} tabs={tabs} activeTabName={name} />
      </div>

      <SuspenseContainer whileMessage={whileMessageI18nKey ? t(whileMessageI18nKey) : 'displaying tab'}>
        {Component && <Component />}
      </SuspenseContainer>
    </div>
  );
};

interface SuspenseContainerProps extends PropsWithChildren {
  whileMessage: string;
  fallback?: ReactNode;
}

const SuspenseContainer: FC<SuspenseContainerProps> = ({ whileMessage, fallback = <SpinnerSection />, children }) => (
  <ErrorBoundary whileMessage={whileMessage}>
    <Suspense fallback={fallback}>{children}</Suspense>
  </ErrorBoundary>
);

const SpinnerSection: FC = () => (
  <div className="flex justify-center my-12">
    <Spinner className="w-20" />
  </div>
);
