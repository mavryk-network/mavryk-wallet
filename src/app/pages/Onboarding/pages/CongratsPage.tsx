import React, { FC, useCallback, useEffect } from 'react';

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

  useEffect(() => {
    delay();
    setOnboardingCompleted(true);
  }, []);

  // const handleGetStartedClick = useCallback(() => {
  //   setOnboardingCompleted(true);
  //   // human delay
  //   delay();
  //   navigate('/');
  // }, [setOnboardingCompleted]);

  return (
    <>
      <p className={styles['title']} {...setTestID(OnboardingSelectors.congratsText)}>
        <T id={'welcomeOnboard'} />
      </p>
      <p className={styles['description']}>
        <T id={'welcomeOnboardDetailsPart1'} />
      </p>
      <p className={styles['description']}>
        <T id={'welcomeOnboardDetailsPart2'} />
      </p>
      <p className={styles['description']}>
        <T id={'welcomeOnboardDetailsPart3'} />
      </p>

      <div className="my-6">
        <p className={clsx(styles['description'], 'text-center flex justify-center')}>
          <T id={'joinCommunity'} />
        </p>
        <div className="flex justify-center">
          <CongratsSocials />
        </div>
      </div>
      <p className={clsx(styles['description'], 'text-center flex justify-center mt-6')}>
        <T id={'goodLuckMsg'} />
      </p>

      <div className="mt-4 text-xl leading-5 tracking-tight text-white">
        Please open the extension from the browsers bar
      </div>

      {/* <ButtonRounded
        fill
        className="w-full mt-4"
        size="big"
        onClick={handleGetStartedClick}
        testID={OnboardingSelectors.congratsStartButton}
      >
        <T id={'getStarted'} />
      </ButtonRounded> */}
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
