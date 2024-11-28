import React, { FC } from 'react';

import clsx from 'clsx';

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

const SecondStep: FC<Props> = ({ setStep, image }) => {
  return (
    <>
      <p className={styles['title']} {...setTestID(OnboardingSelectors.secondStepText)}>
        <T id={'tokensRwasNFTs'} />
      </p>
      <p className={clsx(styles['description'], 'mb-4')}>
        <T id={'tokensDescPart1'} />
      </p>
      <p className={styles['description']}>
        <T id={'tokensDescPart2'} />
      </p>
      <div className="my-8" style={style}>
        {image}
      </div>
      <p className={styles['description']}>
        <T id={'tokensHint'} />
      </p>

      <ButtonRounded
        fill
        className="w-full mt-8"
        size="big"
        onClick={() => setStep(2)}
        testID={OnboardingSelectors.secondStepNextButton}
      >
        <T id={'next'} />
      </ButtonRounded>
    </>
  );
};

export default SecondStep;
