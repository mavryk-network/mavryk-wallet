import React, { FC, useCallback, useState } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { FooterSocials } from 'app/templates/Socials/FooterSocials';
import { T, TID } from 'lib/i18n';

import VerificationForm from './VerificationForm/VerificationForm';

export const ProVersion: FC = () => {
  console.log('hello there');
  // TODO fetch if address is verified
  const [showStakeScreen, setShowStakeScreen] = useState(true);
  const [toolbarRightSidedComponent, setToolbarRightSidedComponent] = useState<JSX.Element | null>(null);
  const { fullPage, popup } = useAppEnv();

  return (
    <PageLayout
      isTopbarVisible={false}
      pageTitle={<T id="proVersion" />}
      removePaddings={popup}
      RightSidedComponent={toolbarRightSidedComponent}
    >
      <div className={clsx('h-full flex-1 flex flex-col', !fullPage && 'pb-8')}>
        {showStakeScreen ? (
          <GetProVersionScreen setShowStakeScreen={setShowStakeScreen} />
        ) : (
          <VerificationForm setToolbarRightSidedComponent={setToolbarRightSidedComponent} />
        )}
      </div>
    </PageLayout>
  );
};

type UnfamiliarListItemType = {
  content: string;
  i18nKey: TID;
};

const proVersionList: UnfamiliarListItemType[] = [
  {
    content: '🔂',
    i18nKey: 'proSreenItem1'
  },
  {
    content: '🏨',
    i18nKey: 'proSreenItem2'
  },
  {
    content: '💸',
    i18nKey: 'proSreenItem3'
  },
  {
    content: '🔓',
    i18nKey: 'proSreenItem4'
  }
];

const UnfamiliarListItem: FC<UnfamiliarListItemType> = ({ content, i18nKey }) => {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex text-2xl`}>{content}</span>
      <span className="text-sm text-white">
        <T id={i18nKey} />
      </span>
    </div>
  );
};

type GetProVersionScreenProps = {
  setShowStakeScreen: (value: boolean) => void;
};

const GetProVersionScreen: FC<GetProVersionScreenProps> = ({ setShowStakeScreen }) => {
  const { popup } = useAppEnv();
  const handleBtnClick = useCallback(() => {
    // skip delegate onboarding screen
    setShowStakeScreen(false);
  }, [setShowStakeScreen]);

  return (
    <div className={clsx(popup && 'px-4 pt-4')}>
      <div className="text-base text-white text-center">
        <T id="joinMavryk" />
      </div>
      <div className="bg-primary-card rounded-2xl-plus py-6 px-4 flex flex-col gap-6 my-6">
        {proVersionList.map(item => (
          <UnfamiliarListItem key={item.i18nKey} {...item} />
        ))}
      </div>
      <section className="flex flex-col items-center">
        <div className="mb-3 text-sm text-white text-center">
          <T id="aboutFooterDescription" />
        </div>
        <FooterSocials />
      </section>
      <ButtonRounded onClick={handleBtnClick} size="big" className={clsx('w-full', popup ? 'mt-40px' : 'mt-18')} fill>
        <T id="getPro" />
      </ButtonRounded>
    </div>
  );
};
