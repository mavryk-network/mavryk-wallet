import React, { FC } from 'react';

import BigNumber from 'bignumber.js';
import clsx from 'clsx';

import { Money } from 'app/atoms';
import { T, TID } from 'lib/i18n';
import { AssetMetadataBase } from 'lib/metadata';

type ManageStakeUnderTextFieldBalanceProps = {
  balance: BigNumber;
  assetMetadata?: AssetMetadataBase;
  i18nkey: TID;
};

export type ManagStakeBalancetype = ManageStakeUnderTextFieldBalanceProps & { id: number };

export const ManageStakeUnderTextFieldBalance: FC<ManageStakeUnderTextFieldBalanceProps> = ({
  balance,
  assetMetadata,
  i18nkey
}) => {
  return (
    <div className="flex text-sm gap-1 items-center">
      <p className="text-secondary-white">
        <T id={i18nkey} />
      </p>
      <div className="text-white">
        <div className="text-white text-sm flex items-center">
          <div className={clsx('text-sm leading-none', 'text-white')}>
            <Money smallFractionFont={false}>{balance}</Money> <span>{assetMetadata?.symbol}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
