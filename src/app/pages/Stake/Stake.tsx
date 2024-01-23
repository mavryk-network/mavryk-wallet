import React, { FC } from 'react';

import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { FooterSocials } from 'app/templates/Socials/FooterSocials';
import { T, TID, t } from 'lib/i18n';

import DelegateForm from './DelegateForm';
import { useBakingHistory } from './hooks/use-baking-history';

export const Stake: FC = () => {
  const { unfamiliarWithDelegation } = useBakingHistory();

  return (
    <PageLayout isTopbarVisible={false} pageTitle={<T id="stake"></T>}>
      <div className="h-full pb-8">{false ? <UnfamiliarWithDelegationScreen /> : <DelegateForm />}</div>
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

const UnfamiliarWithDelegationScreen: FC = () => {
  return (
    <>
      <div className="text-base text-white text-center">
        {/* {`${t('delegationPointsHead1', <>text</>)}`} */}

        <T id="delegationPointsHead1" substitutions={<span className="text-accent-blue">~5.6%</span>} />
      </div>
      <div className="bg-primary-card rounded-2xl-plus p-6 flex flex-col gap-6 my-6">
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
      <ButtonRounded size="big" className="mt-40px w-full" fill>
        <T id="continue" />
      </ButtonRounded>
    </>
  );
};
