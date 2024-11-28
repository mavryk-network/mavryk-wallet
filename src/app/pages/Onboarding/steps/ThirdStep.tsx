import React, { FC } from 'react';

import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { setTestID } from 'lib/analytics';
import { T } from 'lib/i18n';

import styles from '../Onboarding.module.css';
import { OnboardingSelectors } from '../Onboarding.selectors';

interface Props {
  setStep: (step: number) => void;
  image: JSX.Element;
}

const style = {
  height: 404
};

const ThirdStep: FC<Props> = ({ setStep, image }) => {
  return (
    <>
      <p className={styles['title']} {...setTestID(OnboardingSelectors.thirdStepText)}>
        <T id={'profileAndAccounts'} />
      </p>
      <p className={styles['description']}>
        <T id={'profileAndAccountsDesc'} />
      </p>

      <div className="my-8 flex justify-center" style={style}>
        {image}
      </div>
      <p className={styles['description']}>
        <T id={'profileAndAccountsHintPart1'} />
      </p>
      <p className={styles['description']}>
        <T id={'profileAndAccountsHintPart2'} />
      </p>
      <p className={styles['description']}>
        <T id={'profileAndAccountsHintPart3'} />
      </p>

      <ButtonRounded
        fill
        className="w-full mt-4"
        size="big"
        onClick={() => setStep(3)}
        testID={OnboardingSelectors.thirdStepNextButton}
      >
        <T id={'next'} />
      </ButtonRounded>
    </>
  );
};

export default ThirdStep;
