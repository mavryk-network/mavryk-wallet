import React, { FC } from 'react';

import clsx from 'clsx';

import { HashChip, Money } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { AssetIcon } from 'app/templates/AssetIcon';
import { OpenInExplorerChip } from 'app/templates/OpenInExplorerChip';
import { MAV_TOKEN_SLUG } from 'lib/assets';
import { T } from 'lib/i18n';
import { useAssetMetadata } from 'lib/metadata';

import styles from '../successScreen.module.css';

export type SendOperationProps = {
  amount: number;
  assetSlug: string;
  hash: string;
  address: string;
  fees: number;
};

export const SendOperation: FC<SendOperationProps> = ({ amount, assetSlug, hash, address, fees }) => {
  const assetMetadata = useAssetMetadata(assetSlug ?? MAV_TOKEN_SLUG);
  const { popup } = useAppEnv();

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
          <span className="text-secondary-white">
            <T id="address" />:
          </span>
          <HashChip hash={address} small trim={false} className={clsx(popup && styles.breakHash)} />
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
        You can track this transaction’s status in the History tab or&nbsp;
        <br className="hidden xxs:block" />
        Nexus Block Explorer
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
};
