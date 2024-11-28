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
  imgSrc: string;
}

const SecondStep: FC<Props> = ({ setStep, imgSrc }) => {
  return (
    <>
      <p className={styles['title']} {...setTestID(OnboardingSelectors.secondStepText)}>
        <T id={'tokensRwasNFTs'} />
      </p>
      <p className={styles['description']}>
        <T id={'tokensDescPart1'} />
      </p>
      <p className={styles['description']}>
        <T id={'tokensDescPart2'} />
      </p>
      <div className="my-8" style={style}>
        <img src={imgSrc} alt="TokensImg" />
      </div>
      <p className={styles['description']}>
        <T id={'tokensHint'} />
      </p>

      <ButtonRounded
        fill
        className="w-full mt-4"
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
