import React, { FC, ReactNode } from 'react';

import classNames from 'clsx';

import DocBg from 'app/a11y/DocBg';
import Logo from 'app/atoms/Logo';
import { useAppEnv } from 'app/env';
import ContentContainer from 'app/layouts/ContentContainer';

const unlockBg = "misc/UnlockBg.png"

interface PageWithImageBgLayoutProps extends PropsWithChildren {
  title: ReactNode;
  label?:string;
}

const PageWithImageBg: FC<PageWithImageBgLayoutProps> = ({ title, children, label }) => {
  const appEnv = useAppEnv();

  let bagImageSrc = unlockBg
  // Add switch for other BGS

  return (
    <>
      {!appEnv.fullPage && label === 'unlockWallet' && <DocBg bgClassName="bg-cover" />}
      <ContentContainer className={classNames('min-h-screen', 'flex flex-col justify-center', !appEnv.fullPage && !label && 'bg-cover')} style={{backgroundImage: `url(${bagImageSrc})`}}>
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
            appEnv.fullPage
              ? classNames('w-full mx-auto max-w-md', 'rounded-md')
              : classNames('-mx-4', 'border-gray-200'),
            'px-4',
            'shadow-md'
          )}
        >
          {children}
        </div>
      </ContentContainer>
    </>
  );
};

export default PageWithImageBg;
