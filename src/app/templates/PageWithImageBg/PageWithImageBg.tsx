import React, { FC, ReactNode, useMemo } from 'react';

import classNames from 'clsx';

import DocBg from 'app/a11y/DocBg';
import Logo from 'app/atoms/Logo';
import { useAppEnv } from 'app/env';
import ContentContainer from 'app/layouts/ContentContainer';
import { useTempleClient } from 'lib/temple/front';
import { useLocation } from 'lib/woozie';

import styles from './pageWithImageBg.module.css';

const unlockBg = 'misc/UnlockBg.png';

interface PageWithImageBgLayoutProps extends PropsWithChildren {
  title: ReactNode;
  label?: string;
}

const PageWithImageBg: FC<PageWithImageBgLayoutProps> = ({ title, children, label }) => {
  const { fullPage } = useAppEnv();
  const { locked } = useTempleClient();
  const { pathname } = useLocation();

  const bagImageSrc = unlockBg;
  // Add switch for other BGS

  const memoizedContainerStyle = useMemo(
    () => (fullPage ? {} : { backgroundImage: `url(${bagImageSrc})` }),
    [bagImageSrc, fullPage]
  );

  return (
    <>
      <DocBg bgClassName={classNames(getFullScreenBgBasedOnRoute(pathname, fullPage, locked))} />
      <ContentContainer
        className={classNames('min-h-screen', 'flex flex-col justify-center', !fullPage && !label && 'bg-cover')}
        style={memoizedContainerStyle}
      >
        <div className={classNames('flex flex-col items-center justify-center')}>
          <div className="flex items-center">
            <Logo />
          </div>

          <div className={classNames('mt-4', 'text-center', 'text-2xl font-light leading-tight', 'text-primary-white')}>
            {title}
          </div>
        </div>

        <div
          className={classNames(
            fullPage
              ? classNames('w-full mx-auto max-w-screen-xs', 'rounded-md')
              : classNames('-mx-4', 'border-gray-200'),
            'px-4'
          )}
        >
          {children}
        </div>
      </ContentContainer>
    </>
  );
};

export default PageWithImageBg;

const bgRoutes: StringRecord<string> = {
  '/unlock': styles.unlockpageBg,
  '/success': styles.successpageBg
};

function getFullScreenBgBasedOnRoute(route: string, fullPage: boolean, locked: boolean) {
  if (locked) return styles.unlockpageBg;
  if (!fullPage) return 'bg-cover';

  return bgRoutes[route] ?? styles.fullpageBg;
}
