import React from 'react';

import clsx from 'clsx';

import { HashChip, Money } from 'app/atoms';
import { AssetIcon } from 'app/templates/AssetIcon';
import { OpenInExplorerChip } from 'app/templates/OpenInExplorerChip';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { T } from 'lib/i18n';
import { useAssetMetadata } from 'lib/metadata';

import styles from './successScreen.module.css';
import { DelegationOperation } from './templates/DelegationOperations';

// ------------------NAVIGATE STATE PROPS -----------------------------
// send -> // amount, token, hash, fees, address
// swap -> // token1, token2, amount1, amount2, rate, min received, fees, hash
// delegate | re-delegate | co-stake | unlock | finalize -> // amount, token, baker address, hash

type SendOperation = {
  amount: number;
  assetSlug: string;
  hash: string;
  address: string;
  fees: number;
};

export const successContentData = {
  SendOperation: ({ amount, assetSlug, hash, address, fees }: SendOperation) => {
    const assetMetadata = useAssetMetadata(assetSlug ?? MAV_TOKEN_SLUG);

    return (
      <div className="flex flex-col text-center items-center">
        <p className="text-base-plus font-bold mb-2 capitalize">Send transaction submitted</p>
        <div className="text-xl font-bold flex items-center">
          <AssetIcon assetSlug={assetSlug} size={24} className="mr-2 flex-shrink-0 self-start" />
          {'-'}
          <Money smallFractionFont={false} cryptoDecimals={assetMetadata?.decimals}>
            {amount}
          </Money>
          &nbsp;{assetMetadata?.symbol}
        </div>
        {/* <T id="requestSent" substitutions={t(i18nKey)} /> */}
        <div className="bg-primary-card rounded-lg p-3 w-full mt-4">
          <div className="flex items-center justify-between">
            <span className="text-secondary-white">Addres:</span>
            <span>{address}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="text-secondary-white">Fees</div>
            <div>
              <Money smallFractionFont={false} cryptoDecimals={assetMetadata?.decimals}>
                {fees}
              </Money>
              &nbsp;{assetMetadata?.symbol}
            </div>
          </div>
        </div>
        <div className="mt-3 mb-2">
          You can track this transaction’s status in the History tab or Nexus Block Explorer
        </div>
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
    );
  },
  DelegationOperation,
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
