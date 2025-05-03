import React, { FC, useCallback, useState } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { FooterSocials } from 'app/templates/Socials/FooterSocials';
import { T, TID } from 'lib/i18n';
import { useLocation } from 'lib/woozie';

import DelegateForm from './DelegateForm';
import { useBakingHistory } from './hooks/use-baking-history';

export const Stake: FC = () => {
  const { unfamiliarWithDelegation } = useBakingHistory();
  const [showStakeScreen, setShowStakeScreen] = useState(unfamiliarWithDelegation);
  const [isFromCoStakeNavigation, setIsFromCoStakeNavigation] = useState(false);
  const [toolbarRightSidedComponent, setToolbarRightSidedComponent] = useState<JSX.Element | null>(null);
  const { state } = useLocation();
  const [isReDelegationActive, setIsReDelegationActive] = useState(() => unfamiliarWithDelegation || state?.state);
  const { fullPage, popup } = useAppEnv();

  const label = unfamiliarWithDelegation
    ? 'stakeAndEarn'
    : isReDelegationActive
    ? 'reDelegate'
    : showStakeScreen
    ? 'delegate'
    : 'stake';

  const avtivateReDelegation = useCallback(() => {
    setIsReDelegationActive(true);
  }, [setIsReDelegationActive]);

  return (
    <PageLayout
      isTopbarVisible={false}
      pageTitle={<T id={label} />}
      removePaddings={popup}
      RightSidedComponent={toolbarRightSidedComponent}
    >
      <div className={clsx('h-full flex-1 flex flex-col', !fullPage && 'pb-8')}>
        {showStakeScreen ? (
          <UnfamiliarWithDelegationScreen
            setShowStakeScreen={setShowStakeScreen}
            setIsFromCoStakeNavigation={setIsFromCoStakeNavigation}
          />
        ) : (
          <DelegateForm
            setToolbarRightSidedComponent={setToolbarRightSidedComponent}
            unfamiliarWithDelegation={unfamiliarWithDelegation}
            isFromCoStakeNavigation={isFromCoStakeNavigation}
            isReDelegationActive={isReDelegationActive}
            avtivateReDelegation={avtivateReDelegation}
          />
        )}
      </div>
    </PageLayout>
  );
};

type UnfamiliarListItemType = {
  content: string;
  i18nKey: TID;
};

type StakePlanListItemType = UnfamiliarListItemType & { internalList: TID[] };

const unfamiliarDelegateList: UnfamiliarListItemType[] = [
  {
    content: '⭐️',
    i18nKey: 'stakeListItem1'
  },
  {
    content: '💰',
    i18nKey: 'stakeListItem2'
  }
];

const stakingPlanList: StakePlanListItemType[] = [
  {
    content: '💧️',
    i18nKey: 'stakePlanOption1',
    internalList: [
      'delegatePlanListOption1',
      'delegatePlanListOption2',
      'delegatePlanListOption3',
      'delegatePlanListOption4'
    ]
  },
  {
    content: '🔒️',
    i18nKey: 'stakePlanOption2',
    internalList: [
      'coStakePlanListOption1',
      'coStakePlanListOption2',
      'coStakePlanListOption3',
      'coStakePlanListOption4'
    ]
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

const StakePlanListItem: FC<StakePlanListItemType> = ({ content, i18nKey, internalList }) => {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex text-2xl`}>{content}</span>
      <div className="text-sm text-white flex flex-col gap-4">
        <p className="block">
          <T id={i18nKey} />
        </p>
        <ul className="list-disc ml-4">
          {internalList.map(item => (
            <li key={item} className="text-sm text-white">
              <T id={item} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

type UnfamiliarWithDelegationScreenProps = {
  setShowStakeScreen: (value: boolean) => void;
  setIsFromCoStakeNavigation: (value: boolean) => void;
};

const UnfamiliarWithDelegationScreen: FC<UnfamiliarWithDelegationScreenProps> = ({
  setShowStakeScreen,
  setIsFromCoStakeNavigation
}) => {
  const { popup } = useAppEnv();
  const handleBtnClick = useCallback(() => {
    // skip delegate onboarding screen
    setShowStakeScreen(false);
  }, [setShowStakeScreen]);

  const handleCoStakeNavigation = useCallback(() => {
    setIsFromCoStakeNavigation(true);
    setShowStakeScreen(false);
  }, [setIsFromCoStakeNavigation, setShowStakeScreen]);

  return (
    <div className={clsx(popup && 'px-4 pt-4')}>
      <div className="text-base text-white text-left">
        <T id="delegationPointsHead1" substitutions={<span className="text-orange-600 font-bold">5.6%</span>} />
      </div>
      <div className="bg-primary-card rounded-2xl-plus py-6 px-4 flex flex-col gap-6 my-6">
        {unfamiliarDelegateList.map(item => (
          <UnfamiliarListItem key={item.i18nKey} {...item} />
        ))}
      </div>
      <div className="text-base text-white text-left">
        <T id="chooseStakingPlanMsg" />
      </div>
      <div className="bg-primary-card rounded-2xl-plus py-6 px-4 flex flex-col gap-6 mt-4 mb-6">
        {stakingPlanList.map(item => (
          <StakePlanListItem key={item.i18nKey} {...item} />
        ))}
      </div>
      <section className="flex flex-col items-center">
        <div className="mb-3 text-sm text-white text-center">
          <T id="aboutFooterDescription" />
        </div>
        <FooterSocials />
      </section>
      <div className={clsx('grid grid-cols-2 gap-3 mb-8', popup ? 'mt-40px' : 'mt-18')}>
        <ButtonRounded size="big" className={clsx('w-full ')} fill={false} onClick={handleCoStakeNavigation}>
          <T id="coStake" />
        </ButtonRounded>

        <ButtonRounded onClick={handleBtnClick} size="big" className={clsx('w-full')} fill>
          <T id="delegate" />
        </ButtonRounded>
      </div>
    </div>
  );
};
