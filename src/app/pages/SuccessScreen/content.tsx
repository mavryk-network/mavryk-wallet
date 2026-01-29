import React from 'react';

import clsx from 'clsx';

import styles from './successScreen.module.css';
import { DelegationOperation, DelegationOperationProps } from './templates/DelegationOperations';
import { SendOperation, SendOperationProps } from './templates/SendOperation';

// ------------------NAVIGATE STATE PROPS -----------------------------
// send -> // amount, token, hash, fees, address
// swap -> // token1, token2, amount1, amount2, rate, min received, fees, hash
// delegate | re-delegate | co-stake | unlock | finalize -> // amount, token, baker address, hash

export const successContentData = {
  SendOperation: (props: SendOperationProps) => <SendOperation {...props} />,
  DelegationOperation: (props: DelegationOperationProps) => <DelegationOperation {...props} />,
  verifySuccess: () => (
    <div className={clsx('flex flex-col gap-1 text-left self-start mx-5 mt-6', styles.verifyAddress)}>
      {/* <T id="requestSent" substitutions={t(i18nKey)} /> */}
      <p> To use RWA tokens as collateral:</p>
      <br />
      <ol>
        <li>Visit Maven Finance to create a vault</li>
        <li>Return here to verify your vault contract address</li>
      </ol>
    </div>
  )
};
