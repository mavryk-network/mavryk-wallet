import React, { FC } from 'react';

import { Stepper } from 'app/atoms';
import PageLayout from 'app/layouts/PageLayout';
import { t, T } from 'lib/i18n';
import { useStorage } from 'lib/temple/front';

import AddressBalancesImg from './assets/first.png';
import TxActionsImg from './assets/fourth.png';
import TokensImg from './assets/second.png';
import AddressesImg from './assets/third.png';
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

  const steps = (stepWord => [`${stepWord} 1`, `${stepWord} 2`, `${stepWord} 3`, `${stepWord} 4`])(t('step'));
  return (
    <PageLayout
      isTopbarVisible={false}
      hasBackAction={step !== 0}
      pageTitle={
        <span>
          <T id="onboarding" />
        </span>
      }
      step={step}
      setStep={setStep}
      skip={step < 4}
      customContainerMinHeight="auto"
    >
      {step < 4 && <Stepper style={style} steps={steps} currentStep={step} />}
      {step === 0 && <FirstStep setStep={setStep} imgSrc={AddressBalancesImg} />}
      {step === 1 && <SecondStep setStep={setStep} imgSrc={TokensImg} />}
      {step === 2 && <ThirdStep setStep={setStep} imgSrc={AddressesImg} />}
      {step === 3 && <FourthStep setStep={setStep} imgSrc={TxActionsImg} />}
      {step === 4 && <CongratsPage />}
      <div style={{ margin: 'auto' }} className="text-center"></div>
    </PageLayout>
  );
};

export default Onboarding;
