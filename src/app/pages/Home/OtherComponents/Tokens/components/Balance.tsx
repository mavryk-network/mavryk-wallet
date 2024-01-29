import React, { memo } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import Money from 'app/atoms/Money';
import InFiat from 'app/templates/InFiat';
import { TestIDProps } from 'lib/analytics';

interface CryptoBalanceProps extends TestIDProps {
  value: BigNumber;
}

export const CryptoBalance = memo<CryptoBalanceProps>(({ value, testID, testIDProperties }) => (
  <div className="truncate text-base-plus font-medium text-white text-right ml-4 flex-1 flex justify-end">
    <Money smallFractionFont={false} testID={testID} testIDProperties={testIDProperties}>
      {value}
    </Money>
  </div>
));

interface FiatBalanceProps extends CryptoBalanceProps {
  assetSlug: string;
  className?: string;
}

export const FiatBalance = memo<FiatBalanceProps>(({ assetSlug, value, testID, testIDProperties, className }) => (
  <InFiat
    assetSlug={assetSlug}
    volume={value}
    smallFractionFont={false}
    testID={testID}
    testIDProperties={testIDProperties}
  >
    {({ balance, symbol }) => (
      <div
        className={classNames('ml-1 font-normal text-current text-xs flex items-center truncate text-right', className)}
      >
        <span className="mr-1">≈</span>
        <span>{symbol}</span>
        {balance}
      </div>
    )}
  </InFiat>
));
