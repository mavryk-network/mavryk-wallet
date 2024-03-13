import React, { FC } from 'react';

import classNames from 'clsx';

import styles from 'app/atoms/Stepper/Stepper.module.css';
import { ReactComponent as OkIcon } from 'app/icons/ok.svg';

interface Props {
  style?: React.CSSProperties;
  steps: string[];
  currentStep: number;
  completed?: boolean;
}

export const Stepper: FC<Props> = ({ style, steps, currentStep, completed = false }) => {
  return (
    <div className={classNames(styles['stepperWrapper'])} style={style}>
      {steps.map((stepItem, index) => (
        <div className="stepBlock" key={stepItem}>
          <div className={styles['stepWrapper']}>
            <div
              className={classNames(
                'text-white text-base-plus flex items-center justify-center',
                styles['circle'],
                (completed || currentStep) === index && styles['circle-active'],
                (completed || currentStep > index) && styles['circle-passed']
              )}
            >
              {completed || currentStep > index ? <OkIcon style={{ width: '16px', height: '16px' }} /> : index + 1}
            </div>
            {index !== steps.length - 1 && (
              <div className={classNames(styles['line'], currentStep > index && styles['line-active'])} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
