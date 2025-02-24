import React, { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import Money from 'app/atoms/Money';
import InFiat from 'app/templates/InFiat';
import { isTzbtcAsset } from 'lib/assets';
import { useAssetMetadata, getAssetSymbol } from 'lib/metadata';

interface Props {
  assetId: string;
  diff: string;
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
    pending = false,
    isColored = true,
    showFiatBalance = true,
    showAssetSymbol = true,
    className,
    moneyClassname
  }) => {
    const metadata = useAssetMetadata(assetSlug);

    const diffBN = useMemo(() => new BigNumber(diff).div(metadata ? 10 ** metadata.decimals : 1), [diff, metadata]);

    const conditionalPopupClassName = moneyClassname ? moneyClassname : 'text-sm';
    const conditionalDiffClassName = isColored
      ? diffBN.gt(0)
        ? 'text-primary-success'
        : 'text-primary-error'
      : 'text-white';
    const conditionalPendingClassName = pending ? 'text-yellow-600' : conditionalDiffClassName;
    const showPlus = diffBN.gt(0) ? '+' : '';

    return metadata ? (
      <div className={classNames('inline-flex flex-wrap justify-end items-end', className)}>
        <div className={classNames('flex items-baseline', conditionalPopupClassName, conditionalPendingClassName)}>
          <span>{showPlus}</span>
          <Money smallFractionFont={false} cryptoDecimals={isTzbtcAsset(assetSlug) ? metadata.decimals : undefined}>
            {diffBN}
          </Money>
          {showAssetSymbol && (
            <>
              <span>&nbsp;</span>
              <span>{getAssetSymbol(metadata, true)}</span>
            </>
          )}
        </div>

        {assetSlug && showFiatBalance && (
          <InFiat volume={diffBN.abs()} assetSlug={assetSlug} smallFractionFont={false}>
            {({ balance, symbol }) => (
              <div className="text-sm tracking-normal text-secondary-white flex">
                <span>{showPlus ? showPlus : '-'}</span>
                <span className="mr-px">{symbol}</span>
                {balance}
              </div>
            )}
          </InFiat>
        )}
      </div>
    ) : null;
  }
);
