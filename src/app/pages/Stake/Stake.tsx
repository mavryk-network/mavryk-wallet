import React, { FC, useCallback, useState } from 'react';

import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { FooterSocials } from 'app/templates/Socials/FooterSocials';
import { T, TID } from 'lib/i18n';

import DelegateForm from './DelegateForm';
import { useBakingHistory } from './hooks/use-baking-history';

export const Stake: FC = () => {
  const { unfamiliarWithDelegation } = useBakingHistory();
  const [showStakeScreen, setShowStakeScreen] = useState(unfamiliarWithDelegation);
  const [toolbarRightSidedComponent, setToolbarRightSidedComponent] = useState<JSX.Element | null>(null);

  return (
    <PageLayout
      isTopbarVisible={false}
      pageTitle={<T id="stake" />}
      removePaddings
      RightSidedComponent={toolbarRightSidedComponent}
    >
      <div className="h-full pb-8">
        {showStakeScreen ? (
          <UnfamiliarWithDelegationScreen setShowStakeScreen={setShowStakeScreen} />
        ) : (
          <DelegateForm setToolbarRightSidedComponent={setToolbarRightSidedComponent} />
        )}
      </div>
    </PageLayout>
  );
};

type UnfamiliarListItemType = {
  content: string;
  i18nKey: TID;
};

const unfamiliarDelegateList: UnfamiliarListItemType[] = [
  {
    content: '⭐️',
    i18nKey: 'stakeListItem1'
  },
  {
    content: '📆',
    i18nKey: 'stakeListItem2'
  },
  {
    content: '📈',
    i18nKey: 'stakeListItem3'
  },
  {
    content: '🔓',
    i18nKey: 'stakeListItem4'
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

type UnfamiliarWithDelegationScreenProps = {
  setShowStakeScreen: (value: boolean) => void;
};

const UnfamiliarWithDelegationScreen: FC<UnfamiliarWithDelegationScreenProps> = ({ setShowStakeScreen }) => {
  const handleBtnClick = useCallback(() => {
    // skip delegate onboarding screen
    setShowStakeScreen(false);
  }, [setShowStakeScreen]);

  return (
    <div className="px-4 pt-4">
      <div className="text-base text-white text-center">
        <T id="delegationPointsHead1" substitutions={<span className="text-accent-blue">~5.6%</span>} />
      </div>
      <div className="bg-primary-card rounded-2xl-plus py-6 px-4 flex flex-col gap-6 my-6">
        {unfamiliarDelegateList.map(item => (
          <UnfamiliarListItem key={item.i18nKey} {...item} />
        ))}
      </div>
      <section className="flex flex-col items-center">
        <div className="mb-3 text-sm text-white text-center">
          <T id="aboutFooterDescription" />
        </div>
        <FooterSocials />
      </section>
      <ButtonRounded onClick={handleBtnClick} size="big" className="mt-40px w-full" fill>
        <T id="continue" />
      </ButtonRounded>
    </div>
  );
};
