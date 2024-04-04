import React, { FC } from 'react';

import { Stepper } from 'app/atoms';
import PageLayout from 'app/layouts/PageLayout';
import { t, T } from 'lib/i18n';
import { useStorage } from 'lib/temple/front';

import { useOnboardingProgress } from './hooks/useOnboardingProgress.hook';
import CongratsPage from './pages/CongratsPage';
import FirstStep from './steps/FirstStep';
import FourthStep from './steps/FourthStep';
import SecondStep from './steps/SecondStep';
import ThirdStep from './steps/ThirdStep';

const style = {
  marginBottom: 32
};

const Onboarding: FC = () => {
  const [step, setStep] = useStorage<number>(`onboarding_step_state`, 0);
  const { onboardingCompleted } = useOnboardingProgress();

  const steps = (stepWord => [`${stepWord} 1`, `${stepWord} 2`, `${stepWord} 3`, `${stepWord} 4`])(t('step'));
  return (
    <PageLayout
      isTopbarVisible={false}
      pageTitle={
        <span>
          <T id="onboarding" />
        </span>
      }
      step={onboardingCompleted ? undefined : step}
      setStep={onboardingCompleted ? undefined : setStep}
      skip={onboardingCompleted ? false : step < 4}
      hasBackAction={!onboardingCompleted}
    >
      {onboardingCompleted ? (
        <CongratsPage />
      ) : (
        <>
          {step < 4 && <Stepper style={style} steps={steps} currentStep={step} />}
          {step === 0 && <FirstStep setStep={setStep} />}
          {step === 1 && <SecondStep setStep={setStep} />}
          {step === 2 && <ThirdStep setStep={setStep} />}
          {step === 3 && <FourthStep setStep={setStep} />}
          {step === 4 && <CongratsPage />}
        </>
      )}
      <div style={{ margin: 'auto' }} className="text-center"></div>
    </PageLayout>
  );
};

export default Onboarding;
