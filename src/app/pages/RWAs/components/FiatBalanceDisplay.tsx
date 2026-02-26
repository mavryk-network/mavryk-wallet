import React, { FC, ReactNode } from 'react';

/**
 * Shared render callback for InFiat component used across RWA views.
 * Displays a fiat currency symbol followed by the balance amount.
 */
interface FiatBalanceDisplayProps {
  balance: ReactNode;
  symbol: string;
}

export const FiatBalanceDisplay: FC<FiatBalanceDisplayProps> = ({ balance, symbol }) => (
  <div className="ml-1 font-normal text-white flex items-center truncate text-right">
    <span>{symbol}</span>
    {balance}
  </div>
);

/**
 * Render callback function for use with the InFiat component's children prop.
 * Usage: <InFiat ...>{renderFiatBalance}</InFiat>
 */
export const renderFiatBalance = ({ balance, symbol }: FiatBalanceDisplayProps) => (
  <FiatBalanceDisplay balance={balance} symbol={symbol} />
);
