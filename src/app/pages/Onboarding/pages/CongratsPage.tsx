import React, { FC, useCallback } from 'react';

import clsx from 'clsx';

import { Anchor } from 'app/atoms';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { AboutFooterLinkItemType } from 'app/templates/Socials/social.types';
import { FOOTER_LINKS } from 'app/templates/Socials/socials.consts';
import { setTestID } from 'lib/analytics';
import { T } from 'lib/i18n';
import { delay } from 'lib/utils';
import { navigate } from 'lib/woozie';

import { useOnboardingProgress } from '../hooks/useOnboardingProgress.hook';
import styles from '../Onboarding.module.css';
import { OnboardingSelectors } from '../Onboarding.selectors';

const CongratsPage: FC = () => {
  const { setOnboardingCompleted } = useOnboardingProgress();

  const handleGetStartedClick = useCallback(() => {
    setOnboardingCompleted(true);
    // human delay
    delay();
    navigate('/');
  }, [setOnboardingCompleted]);

  return (
    <>
      <p className={styles['title']} {...setTestID(OnboardingSelectors.congratsText)}>
        <T id={'welcomeOnboard'} />
      </p>
      <p className={clsx(styles['description'], 'mb-4')}>
        <T id={'welcomeOnboardDetailsPart1'} />
      </p>
      <p className={clsx(styles['description'], 'mb-4')}>
        <T id={'welcomeOnboardDetailsPart2'} />
      </p>
      <p className={clsx(styles['description'])}>
        <T id={'welcomeOnboardDetailsPart3'} />
      </p>

      <div className="my-6">
        <p className={clsx(styles['description'], 'text-center flex justify-center mb-4')}>
          <T id={'joinCommunity'} />
        </p>
        <div className="flex justify-center">
          <CongratsSocials />
        </div>
      </div>
      <p className={clsx(styles['description'], 'text-center flex justify-center')}>
        <T id={'goodLuckMsg'} />
      </p>

      <ButtonRounded
        fill
        className="w-full mt-8"
        size="big"
        onClick={handleGetStartedClick}
        testID={OnboardingSelectors.congratsStartButton}
      >
        <T id={'getStarted'} />
      </ButtonRounded>
    </>
  );
};

export default CongratsPage;

const CongratsSocials: FC = () => {
  return (
    <div className={clsx('flex items-center gap-6 w-fit')}>
      {FOOTER_LINKS.map(link => (
        <Socialitem {...link} />
      ))}
    </div>
  );
};

const Socialitem: FC<AboutFooterLinkItemType> = ({ Icon, link, testID }) => {
  return (
    <Anchor
      testID={testID}
      href={link}
      className="bg-accent-blue flex items-center justify-center no-underline rounded-md w-8 h-8"
    >
      <Icon className="w-full h-full" />
    </Anchor>
  );
};
