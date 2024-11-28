import React, { FC } from 'react';

import { Anchor } from 'app/atoms';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { setTestID } from 'lib/analytics';
import { T } from 'lib/i18n';

import styles from '../Onboarding.module.css';
import { OnboardingSelectors } from '../Onboarding.selectors';

interface Props {
  setStep: (step: number) => void;
  image: JSX.Element;
}

const FirstStep: FC<Props> = ({ setStep, image }) => {
  return (
    <>
      <p className={styles['title']} {...setTestID(OnboardingSelectors.firstStepText)}>
        <T id={'addressBalanceDetails'} />
      </p>
      <p className={styles['description']}>
        <T id={'addressBalanceDescription'} />
      </p>
      <div style={{ height: 324 }} className="my-8">
        {image}
      </div>
      <p className={styles['description']}>
        <T
          id={'addressBalanceHint'}
          substitutions={[
            <Anchor href="https://mavryk.org/domains" className="text-accent-blue">
              Mavryk Domains
            </Anchor>
          ]}
        />
      </p>
      <ButtonRounded
        fill
        className="w-full mt-4"
        size="big"
        onClick={() => setStep(1)}
        testID={OnboardingSelectors.firstStepNextButton}
      >
        <T id={'next'} />
      </ButtonRounded>
    </>
  );
};

export default FirstStep;
