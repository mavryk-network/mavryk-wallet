import React, { FC, ReactElement, ReactNode, useMemo } from 'react';

import { isDefined } from '@rnw-community/shared';
import BigNumber from 'bignumber.js';

import Money from 'app/atoms/Money';
import { TestIDProps } from 'lib/analytics';
import { useAssetFiatCurrencyPrice, useFiatCurrency } from 'lib/fiat-currency';
import { useNetwork } from 'lib/temple/front';

interface OutputProps {
  balance: ReactNode;
  symbol: string;
}

interface InFiatProps extends TestIDProps {
  volume: BigNumber | number | string;
  assetSlug?: string;
  children: (output: OutputProps) => ReactElement;
  roundingMode?: BigNumber.RoundingMode;
  shortened?: boolean;
  smallFractionFont?: boolean;
  mainnet?: boolean;
  showCents?: boolean;
  tooltip?: boolean;
}

const InFiat: FC<InFiatProps> = ({
  volume,
  assetSlug,
  children,
  roundingMode,
  shortened,
  smallFractionFont,
  mainnet,
  showCents = true,
  tooltip = true,
  testID,
  testIDProperties
}) => {
  const price = useAssetFiatCurrencyPrice(assetSlug ?? 'mav');
  const { selectedFiatCurrency } = useFiatCurrency();
  const walletNetwork = useNetwork();

  if (mainnet === undefined) {
    mainnet = walletNetwork.type === 'main';
  }

  const roundedInFiat = useMemo(() => {
    if (!isDefined(price)) return new BigNumber(0);

    const inFiat = new BigNumber(volume).times(price);
    if (showCents) {
      return inFiat;
    }
    return inFiat.integerValue();
  }, [price, showCents, volume]);

  const cryptoDecimals = showCents ? undefined : 0;

  return children({
    balance: (
      <Money
        fiat={showCents}
        cryptoDecimals={cryptoDecimals}
        roundingMode={roundingMode}
        shortened={shortened}
        smallFractionFont={smallFractionFont}
        testID={testID}
        testIDProperties={testIDProperties}
        tooltip={tooltip}
      >
        {roundedInFiat}
      </Money>
    ),
    symbol: selectedFiatCurrency.symbol
  });
};

export default InFiat;
