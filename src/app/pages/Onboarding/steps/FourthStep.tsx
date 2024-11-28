import React, { FC } from 'react';

import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { setTestID } from 'lib/analytics';
import { T } from 'lib/i18n';

import styles from '../Onboarding.module.css';
import { OnboardingSelectors } from '../Onboarding.selectors';

const style = {
  height: 379
};

interface Props {
  setStep: (step: number) => void;
  image: JSX.Element;
}

const FourthStep: FC<Props> = ({ setStep, image }) => {
  return (
    <>
      <p className={styles['title']} {...setTestID(OnboardingSelectors.fourthStepText)}>
        <T id={'txActionsTitle'} />
      </p>
      <p className={styles['description']}>
        <T id={'txActionsDetailsPart1'} />
      </p>
      <p className={styles['description']}>
        <T id={'txActionsDetailsPart2'} />
      </p>
      <p className={styles['description']}>
        <T id={'txActionsDetailsPart3'} />
      </p>
      <p className={styles['description']}>
        <T id={'txActionsDetailsPart4'} />
      </p>
      <div className="my-8" style={style}>
        {image}
      </div>

      <ButtonRounded
        fill
        className="w-full mt-4"
        size="big"
        onClick={() => setStep(4)}
        testID={OnboardingSelectors.fourthStepDoneButton}
      >
        <T id={'next'} />
      </ButtonRounded>
    </>
  );
};

export default FourthStep;
