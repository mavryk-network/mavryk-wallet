import React from 'react';

import BigNumber from 'bignumber.js';

import InFiat from 'app/templates/InFiat';
import { T } from 'lib/i18n';
import { AssetMetadataBase, getAssetSymbol } from 'lib/metadata';

interface TokenToFiatProps {
  amountValue: string;
  assetMetadata: AssetMetadataBase | nullish;
  shoudUseFiat: boolean;
  assetSlug: string;
  toAssetAmount: (fiatAmount: BigNumber.Value) => string;
}

export const TokenToFiat: React.FC<TokenToFiatProps> = ({
  amountValue = new BigNumber(0),
  assetMetadata,
  shoudUseFiat,
  assetSlug,
  toAssetAmount
}) => {
  if (!amountValue) return null;

  return (
    <div className="absolute left-4 bottom-4">
      {shoudUseFiat ? (
        <div className="text-secondary-white text-sm ">
          <span className="text-base-plus">&asymp;&nbsp;</span>
          <span className="font-normal text-secondary-white mr-1">{toAssetAmount(amountValue)}</span>{' '}
          <T id="inAsset" substitutions={getAssetSymbol(assetMetadata, true)} />
        </div>
      ) : (
        <InFiat
          assetSlug={assetSlug}
          volume={amountValue}
          roundingMode={BigNumber.ROUND_FLOOR}
          smallFractionFont={false}
        >
          {({ balance, symbol }) => (
            <div className="flex items-baseline text-sm text-secondary-white ">
              <span>&asymp;&nbsp;</span>
              <span className="flex items-baseline">
                <span className="pr-px">{symbol}</span>
                {balance}
              </span>
            </div>
          )}
        </InFiat>
      )}
    </div>
  );
};
