import React from 'react';

import clsx from 'clsx';

import { HashChip } from 'app/atoms';
import { OpenInExplorerChip } from 'app/templates/OpenInExplorerChip';
import { T, t, TID } from 'lib/i18n';

import styles from './successScreen.module.css';
import { DelegationOperation, DelegationOperationProps } from './templates/DelegationOperations';
import { SendOperation, SendOperationProps } from './templates/SendOperation';

// ------------------NAVIGATE STATE PROPS -----------------------------
// send -> // amount, token, hash, fees, address
// swap -> // token1, token2, amount1, amount2, rate, min received, fees, hash
// delegate | re-delegate | co-stake | unlock | finalize -> // amount, token, baker address, hash

export const successContentData = {
  hash: ({ hash, i18nKey }: { hash: string; i18nKey: TID }) => (
    <div className="flex flex-col items-center gap-2">
      <T id="requestSent" substitutions={t(i18nKey)} />
      <div className="flex items-center">
        <T id="operationHash" />:
        <HashChip hash={hash} firstCharsCount={10} lastCharsCount={7} small className="mx-2" />
        <OpenInExplorerChip hash={hash} small />
      </div>
    </div>
  ),
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
