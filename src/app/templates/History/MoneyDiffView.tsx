import React, { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import Money from 'app/atoms/Money';
import InFiat from 'app/templates/InFiat';
import { isTzbtcAsset } from 'lib/assets';
import { useFiatCurrency, useFiatToUsdRate } from 'lib/fiat-currency';
import { useAssetMetadata, getAssetSymbol } from 'lib/metadata';

interface Props {
  assetId: string;
  diff: string;
  symbol?: string;
  usdAmount?: number | null;
  isNeutral?: boolean;
  isNegative?: boolean;
  isAmountUnavailable?: boolean;
  pending?: boolean;
  className?: string;
  moneyClassname?: string;
  isColored?: boolean;
  showFiatBalance?: boolean;
  showAssetSymbol?: boolean;
}

export const MoneyDiffView = memo<Props>(
  ({
    assetId: assetSlug,
    diff,
    symbol,
    usdAmount,
    isNeutral,
    isNegative,
    isAmountUnavailable,
    pending = false,
    isColored = true,
    showFiatBalance = true,
    showAssetSymbol = true,
    className,
    moneyClassname
  }) => {
    const metadata = useAssetMetadata(assetSlug);

    const diffBN = useMemo(() => new BigNumber(diff), [diff]);

    const conditionalPopupClassName = moneyClassname ? moneyClassname : 'text-sm';
    const conditionalDiffClassName =
      isColored && !isNeutral && !isAmountUnavailable
        ? diffBN.gt(0)
          ? 'text-primary-success'
          : 'text-primary-error'
        : 'text-white';
    const conditionalPendingClassName = pending ? 'text-yellow-600' : conditionalDiffClassName;
    const showPlus = !isNeutral && diffBN.gt(0) ? '+' : '';
    const sign = isNeutral || diffBN.isZero() ? '' : isAmountUnavailable ? (isNegative ? '-' : '+') : showPlus || '-';

    return metadata || symbol || isAmountUnavailable ? (
      <div className={classNames('inline-flex flex-wrap justify-end items-end', className)}>
        <div className={classNames('flex items-baseline', conditionalPopupClassName, conditionalPendingClassName)}>
          <span>{showPlus}</span>
          {isAmountUnavailable ? (
            <span>—</span>
          ) : (
            <Money smallFractionFont={false} cryptoDecimals={isTzbtcAsset(assetSlug) ? metadata?.decimals : undefined}>
              {diffBN}
            </Money>
          )}
          {showAssetSymbol && (
            <>
              <span>&nbsp;</span>
              <span>{symbol ?? getAssetSymbol(metadata, true)}</span>
            </>
          )}
        </div>

        {showFiatBalance && usdAmount !== undefined ? (
          <HistoryFiatAmount usdAmount={usdAmount} sign={sign} />
        ) : (
          metadata &&
          assetSlug &&
          showFiatBalance && (
            <InFiat volume={diffBN.abs()} assetSlug={assetSlug} smallFractionFont={false}>
              {({ balance, symbol }) => (
                <div className="text-sm tracking-normal text-secondary-white flex">
                  <span>{sign}</span>
                  <span className="mr-px">{symbol}</span>
                  {balance}
                </div>
              )}
            </InFiat>
          )
        )}
      </div>
    ) : null;
  }
);

/** Format an API USD value using the existing USD-to-selected-fiat rate, without token repricing. */
const HistoryFiatAmount = ({ usdAmount, sign }: { usdAmount: number | null; sign: string }) => {
  const { selectedFiatCurrency } = useFiatCurrency();
  const rate = useFiatToUsdRate();
  const effectiveRate = selectedFiatCurrency.name.toLowerCase() === 'usd' ? 1 : rate;
  const isAvailable = usdAmount != null && Number.isFinite(usdAmount) && effectiveRate != null;
  return (
    <div className="text-sm tracking-normal text-secondary-white flex">
      {isAvailable ? (
        <>
          {usdAmount === 0 ? '' : sign}
          {selectedFiatCurrency.symbol}
          <Money fiat smallFractionFont={false}>
            {new BigNumber(usdAmount!).abs().times(effectiveRate!)}
          </Money>
        </>
      ) : (
        '—'
      )}
    </div>
  );
};
