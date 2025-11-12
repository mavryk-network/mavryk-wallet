import React from 'react';

import clsx from 'clsx';

import { HashChip } from 'app/atoms';
import { OpenInExplorerChip } from 'app/templates/OpenInExplorerChip';
import { T, TID, t } from 'lib/i18n';

import styles from './successScreen.module.css';

export const successContentData = {
  hash: ({ i18nKey, hash }: { i18nKey: TID; hash: string }) => (
    <div className="flex flex-col gap-1 text-center items-center">
      <p className="text-base-plus  font-bold">Send transaction submitted</p>
      <p className="text-xl  font-bold">-2,500.00 MVRK</p>
      {/* <T id="requestSent" substitutions={t(i18nKey)} /> */}
      <div className="bg-primary-card rounded-lg p-3 w-full">
        <div className="flex items-center justify-between">
          <span>Addres:</span>
          <span>mv1PeZx7FXy7QRuMREGXGxeipb24RsMMzUNe</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span>Fees</span>
          <span>0.01 MVRK</span>
        </div>
      </div>
      <div className="mt-3">You can track this transaction’s status in the History tab or Nexus Block Explorer</div>
      <div className="flex items-center text-white">
        <T id="operationHash" />:
        <HashChip
          hash={hash}
          firstCharsCount={10}
          lastCharsCount={7}
          showIcon={false}
          key="hash"
          className="ml-2 mr-1 bg-primary-card px-1 rounded text-xs"
          style={{ paddingBlock: 3, fontSize: 12 }}
        />
        <OpenInExplorerChip hash={hash} small />
      </div>
    </div>
  ),
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

// chrome-extension://hijkcblfoamgeomngnjhffoafbkbeabe/fullpage.html#/success
