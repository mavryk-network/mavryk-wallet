import React, { memo } from 'react';

import BigNumber from 'bignumber.js';
import clsx from 'clsx';

import Money from 'app/atoms/Money';
import InFiat from 'app/templates/InFiat';
import { TestIDProps } from 'lib/analytics';
import { merge } from 'lib/utils/merge';

interface CryptoBalanceProps extends TestIDProps {
  value: BigNumber;
  cryptoDecimals?: number;
}

export const CryptoBalance = memo<CryptoBalanceProps>(({ value, cryptoDecimals, testID, testIDProperties }) => (
  <div className={clsx('truncate text-base-plus text-white text-right ml-4 flex-1 flex justify-end')}>
    <Money
      smallFractionFont={false}
      cryptoDecimals={cryptoDecimals}
      testID={testID}
      testIDProperties={testIDProperties}
    >
      {value}
    </Money>
  </div>
));

interface FiatBalanceProps extends TestIDProps {
  assetSlug: string;
  className?: string;
  showEqualSymbol?: boolean;
  customSymbol?: string;
  value: BigNumber | string | number;
  roundingMode?: BigNumber.RoundingMode;
  tooltip?: boolean;
}
export const FiatBalance = memo<FiatBalanceProps>(
  ({
    assetSlug,
    tooltip,
    value,
    testID,
    testIDProperties,
    className,
    roundingMode,
    customSymbol,
    showEqualSymbol = true
  }) => (
    <InFiat
      assetSlug={assetSlug}
      volume={value}
      smallFractionFont={false}
      testID={testID}
      testIDProperties={testIDProperties}
      roundingMode={roundingMode}
      tooltip={tooltip}
    >
      {({ balance, symbol }) => (
        <div
          className={merge('ml-1 font-normal text-current flex items-center truncate text-right text-xs', className)}
        >
          {showEqualSymbol && <span className="mr-1">≈</span>}
          {customSymbol && <span>{customSymbol}</span>}
          <span>{symbol}</span>
          {balance}
        </div>
      )}
    </InFiat>
  )
);
