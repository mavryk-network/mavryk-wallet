import React, { FC, useState } from 'react';

import { Stepper } from 'app/atoms';
import PageLayout from 'app/layouts/PageLayout';
import { t, T } from 'lib/i18n';
import { useStorage } from 'lib/temple/front';

import CongratsPage from './pages/CongratsPage';
import FirstStep from './steps/FirstStep';
import FourthStep from './steps/FourthStep';
import SecondStep from './steps/SecondStep';
import ThirdStep from './steps/ThirdStep';

const style = {
  marginBottom: 32
};

const Onboarding: FC = () => {
  // const [step, setStep] = useStorage<number>(`onboarding_step_state`, 0);
  const [step, setStep] = useState<number>(0);

  const steps = (stepWord => [`${stepWord} 1`, `${stepWord} 2`, `${stepWord} 3`, `${stepWord} 4`])(t('step'));
  return (
    <PageLayout
      isTopbarVisible={false}
      pageTitle={
        <span>
          <T id="onboarding" />
        </span>
      }
      step={step}
      setStep={setStep}
      skip={step < 4}
    >
      <div style={{ margin: 'auto' }} className="pb-8 text-center">
        {step < 4 && <Stepper style={style} steps={steps} currentStep={step} />}
        {step === 0 && <FirstStep setStep={setStep} />}
        {step === 1 && <SecondStep setStep={setStep} />}
        {step === 2 && <ThirdStep setStep={setStep} />}
        {step === 3 && <FourthStep setStep={setStep} />}
        {step === 4 && <CongratsPage />}
      </div>
    </PageLayout>
  );
};

export default Onboarding;
