import React, { memo, FC } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import Money from 'app/atoms/Money';
import AddressChip from 'app/templates/AddressChip';
import { useFiatCurrency } from 'lib/fiat-currency';
import { useTotalBalance } from 'lib/temple/front/use-total-balance.hook';

import { HomeSelectors } from '../Home.selectors';
import styles from './MainBanner.module.css';

interface Props {
  assetSlug?: string | null;
  accountPkh: string;
}

const MainBanner = memo<Props>(({ accountPkh }) => {
  return <TotalVolumeBanner accountPkh={accountPkh} />;
});

export default MainBanner;

interface TotalVolumeBannerProps {
  accountPkh: string;
}

const TotalVolumeBanner: FC<TotalVolumeBannerProps> = ({ accountPkh }) => (
  <div
    className={classNames(
      styles.banner,
      'bg-primary-card text-primary-white rounded-xl p-4 flex flex-col gap-y-4 items-start justify-between w-full max-w-sm mx-auto mb-4'
    )}
  >
    <BalanceInfo />
    <div className="flex justify-between items-center w-full">
      <AddressChip pkh={accountPkh} testID={HomeSelectors.publicAddressButton} />
    </div>
  </div>
);

const BalanceInfo: FC = () => {
  const { totalBalanceInFiat } = useTotalBalance();

  const {
    selectedFiatCurrency: { symbol: fiatSymbol }
  } = useFiatCurrency();

  return (
    <div className="flex flex-col justify-between items-start">
      <div className="flex items-center text-3xl-plus">
        <BalanceFiat volume={totalBalanceInFiat} currency={fiatSymbol} />
      </div>
    </div>
  );
};

interface BalanceProps {
  volume: number | string | BigNumber;
  currency: string;
}
const BalanceFiat: FC<BalanceProps> = ({ volume, currency }) => (
  <>
    <span className="mr-1">≈</span>
    <span className="ml-1">{currency}</span>
    <Money smallFractionFont={false} fiat>
      {volume}
    </Money>
  </>
);
