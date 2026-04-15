import React, { memo, FC } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';

import Money from 'app/atoms/Money';
import { useAppEnv } from 'app/env';
import { ReactComponent as EyeClosedIcon } from 'app/icons/eye-closed-thin.svg';
import { ReactComponent as EyeOpenIcon } from 'app/icons/eye-open-secondary.svg';
import AddressChip from 'app/templates/AddressChip';
import { useFiatCurrency } from 'lib/fiat-currency';
import { usePrivacyMode, useUIStore } from 'lib/store/zustand/ui.store';

import { HomeSelectors } from '../../Home.selectors';

import styles from './MainBanner.module.css';
import { useTotalBalance } from './use-total-balance';

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

const TotalVolumeBanner: FC<TotalVolumeBannerProps> = ({ accountPkh }) => {
  const { popup } = useAppEnv();

  return (
    <div
      className={classNames(
        styles.banner,
        popup ? styles.circlesPopup : styles.circlesFullView,
        'bg-primary-card text-primary-white rounded-xl p-4 flex flex-col gap-y-4 items-start justify-between w-full mx-auto mb-4',
        popup && 'max-w-sm'
      )}
    >
      <BalanceInfo />
      <div className="flex justify-between items-center w-full">
        <AddressChip pkh={accountPkh} testID={HomeSelectors.publicAddressButton} />
      </div>
    </div>
  );
};

const BalanceInfo: FC = () => {
  const totalBalanceInFiat = useTotalBalance(true);

  const {
    selectedFiatCurrency: { symbol: fiatSymbol }
  } = useFiatCurrency();

  const privacyMode = usePrivacyMode();
  const togglePrivacyMode = useUIStore(s => s.togglePrivacyMode);

  return (
    <div className="flex justify-between items-center w-full">
      <div className="flex items-center text-2xl-plus">
        <BalanceFiat volume={totalBalanceInFiat} currency={fiatSymbol} />
      </div>
      <button
        type="button"
        onClick={togglePrivacyMode}
        className="opacity-60 hover:opacity-100 transition-opacity"
        title={privacyMode ? 'Show balances on home screen' : 'Hide balances on home screen'}
      >
        {privacyMode ? (
          <EyeOpenIcon className="w-6 h-6 fill-white" />
        ) : (
          <EyeClosedIcon className="w-6 h-6 fill-white" />
        )}
      </button>
    </div>
  );
};

interface BalanceProps {
  volume: number | string | BigNumber;
  currency: string;
}

export const BalanceFiat: FC<BalanceProps> = ({ volume, currency }) => {
  const privacyMode = usePrivacyMode();

  if (privacyMode) {
    return (
      <span aria-label="Hidden balance">
        {currency}
        ••••
      </span>
    );
  }

  return (
    <>
      <span className="mr-1">≈</span>
      <span className="ml-1">{currency}</span>
      <Money smallFractionFont={false} fiat>
        {volume}
      </Money>
    </>
  );
};
