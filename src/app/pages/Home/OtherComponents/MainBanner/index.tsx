import React, { memo, FC } from 'react';

<<<<<<< HEAD:src/app/pages/Home/OtherComponents/MainBanner.tsx
import BigNumber from 'bignumber.js';
import classNames from 'clsx';
=======
import clsx from 'clsx';
import { useDispatch } from 'react-redux';
>>>>>>> master:src/app/pages/Home/OtherComponents/MainBanner/index.tsx

import Money from 'app/atoms/Money';
<<<<<<< HEAD:src/app/pages/Home/OtherComponents/MainBanner.tsx
import AddressChip from 'app/templates/AddressChip';
import { useFiatCurrency } from 'lib/fiat-currency';
import { useTotalBalance } from 'lib/temple/front/use-total-balance.hook';

import { HomeSelectors } from '../Home.selectors';
import styles from './MainBanner.module.css';
=======
import { useTotalBalance } from 'app/pages/Home/OtherComponents/MainBanner/use-total-balance';
import { toggleBalanceModeAction } from 'app/store/settings/actions';
import { useBalanceModeSelector } from 'app/store/settings/selectors';
import { BalanceMode } from 'app/store/settings/state';
import AddressChip from 'app/templates/AddressChip';
import { AssetIcon } from 'app/templates/AssetIcon';
import Balance from 'app/templates/Balance';
import InFiat from 'app/templates/InFiat';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { useGasToken } from 'lib/assets/hooks';
import { useFiatCurrency } from 'lib/fiat-currency';
import { t, T } from 'lib/i18n';
import { TezosLogoIcon } from 'lib/icons';
import { getAssetName, getAssetSymbol, useAssetMetadata } from 'lib/metadata';
import { useNetwork } from 'lib/temple/front';
import useTippy from 'lib/ui/useTippy';

import { HomeSelectors } from '../../Home.selectors';
import { TokenPageSelectors } from '../TokenPage.selectors';

import { BalanceFiat } from './BalanceFiat';
import { BalanceGas } from './BalanceGas';
>>>>>>> master:src/app/pages/Home/OtherComponents/MainBanner/index.tsx

interface Props {
  assetSlug?: string | null;
  accountPkh: string;
}

<<<<<<< HEAD:src/app/pages/Home/OtherComponents/MainBanner.tsx
const MainBanner = memo<Props>(({ accountPkh }) => {
  return <TotalVolumeBanner accountPkh={accountPkh} />;
});
=======
const MainBanner: FC<Props> = ({ assetSlug, accountPkh }) => {
  return assetSlug ? (
    <AssetBanner assetSlug={assetSlug ?? 'tez'} accountPkh={accountPkh} />
  ) : (
    <TotalVolumeBanner accountPkh={accountPkh} />
  );
};
>>>>>>> master:src/app/pages/Home/OtherComponents/MainBanner/index.tsx

export default MainBanner;

interface TotalVolumeBannerProps {
  accountPkh: string;
}

<<<<<<< HEAD:src/app/pages/Home/OtherComponents/MainBanner.tsx
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
=======
const TotalVolumeBanner = memo<TotalVolumeBannerProps>(({ accountPkh }) => (
  <div className="flex items-start justify-between w-full max-w-sm mx-auto mb-4">
    <BalanceInfo accountPkh={accountPkh} />
    <AddressChip pkh={accountPkh} testID={HomeSelectors.publicAddressButton} />
>>>>>>> master:src/app/pages/Home/OtherComponents/MainBanner/index.tsx
  </div>
));

<<<<<<< HEAD:src/app/pages/Home/OtherComponents/MainBanner.tsx
const BalanceInfo: FC = () => {
  const { totalBalanceInFiat } = useTotalBalance();
=======
const BalanceInfo: FC<{ accountPkh: string }> = ({ accountPkh }) => {
  const dispatch = useDispatch();
  const network = useNetwork();
  const totalBalanceInDollar = useTotalBalance();
  const balanceMode = useBalanceModeSelector();
>>>>>>> master:src/app/pages/Home/OtherComponents/MainBanner/index.tsx

  const {
    selectedFiatCurrency: { symbol: fiatSymbol }
  } = useFiatCurrency();

<<<<<<< HEAD:src/app/pages/Home/OtherComponents/MainBanner.tsx
  return (
    <div className="flex flex-col justify-between items-start">
      <div className="flex items-center text-3xl-plus">
        <BalanceFiat volume={totalBalanceInFiat} currency={fiatSymbol} />
=======
  const {
    metadata: { name: gasTokenName, symbol: gasTokenSymbol }
  } = useGasToken();

  const tippyProps = useMemo(
    () => ({
      trigger: 'mouseenter',
      hideOnClick: false,
      content: t('showInGasOrFiat', [fiatName, gasTokenSymbol]),
      animation: 'shift-away-subtle'
    }),
    [fiatName, gasTokenSymbol]
  );

  const buttonRef = useTippy<HTMLButtonElement>(tippyProps);

  const nextBalanceMode = balanceMode === BalanceMode.Fiat ? BalanceMode.Gas : BalanceMode.Fiat;

  const handleTvlModeToggle = () => dispatch(toggleBalanceModeAction(nextBalanceMode));

  const isMainNetwork = network.type === 'main';
  const isFiatMode = balanceMode === BalanceMode.Fiat;
  const shouldShowFiatBanner = isMainNetwork && isFiatMode;

  return (
    <div className="flex flex-col justify-between items-start">
      <div className="flex items-center">
        {isMainNetwork && (
          <Button
            ref={buttonRef}
            style={{ height: '22px', width: '22px' }}
            className={clsx(
              'mr-1 p-1',
              'bg-gray-100',
              'rounded-sm shadow-xs',
              'text-base font-medium',
              'hover:text-gray-600 text-gray-500 leading-none select-none',
              'transition ease-in-out duration-300',
              'inline-flex items-center justify-center'
            )}
            onClick={handleTvlModeToggle}
            testID={HomeSelectors.fiatTezSwitchButton}
            testIDProperties={{ toValue: nextBalanceMode }}
          >
            {isFiatMode ? fiatSymbol : <TezosLogoIcon />}
          </Button>
        )}

        <div className="text-sm font-medium text-gray-700" {...setTestID(HomeSelectors.fiatTezSwitchText)}>
          {shouldShowFiatBanner ? (
            <T id="totalEquityValue" />
          ) : (
            <>
              {gasTokenName} <T id="balance" />
            </>
          )}
        </div>
      </div>

      <div className="flex items-center text-2xl">
        {shouldShowFiatBanner ? (
          <BalanceFiat totalBalanceInDollar={totalBalanceInDollar} currency={fiatSymbol} />
        ) : (
          <BalanceGas totalBalanceInDollar={totalBalanceInDollar} currency={gasTokenSymbol} accountPkh={accountPkh} />
        )}
>>>>>>> master:src/app/pages/Home/OtherComponents/MainBanner/index.tsx
      </div>
    </div>
  );
};

<<<<<<< HEAD:src/app/pages/Home/OtherComponents/MainBanner.tsx
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
=======
interface AssetBannerProps {
  assetSlug: string;
  accountPkh: string;
}

const AssetBanner = memo<AssetBannerProps>(({ assetSlug, accountPkh }) => {
  const assetMetadata = useAssetMetadata(assetSlug);
  const assetName = getAssetName(assetMetadata);
  const assetSymbol = getAssetSymbol(assetMetadata);

  return (
    <div className="w-full max-w-sm mx-auto mb-4">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <AssetIcon assetSlug={assetSlug} size={24} className="flex-shrink-0" />

          <div
            className="text-sm font-normal text-gray-700 truncate flex-1 ml-2"
            {...setTestID(TokenPageSelectors.tokenName)}
            {...setAnotherSelector('name', assetName)}
          >
            {assetName}
          </div>
        </div>

        <AddressChip pkh={accountPkh} modeSwitch={{ testID: HomeSelectors.addressModeSwitchButton }} />
      </div>

      <div className="flex items-center text-2xl">
        <Balance address={accountPkh} assetSlug={assetSlug}>
          {balance => (
            <div className="flex flex-col">
              <div className="flex text-2xl">
                <Money smallFractionFont={false} fiat>
                  {balance}
                </Money>
                <span className="ml-1">{assetSymbol}</span>
              </div>

              <InFiat assetSlug={assetSlug} volume={balance} smallFractionFont={false}>
                {({ balance, symbol }) => (
                  <div style={{ lineHeight: '19px' }} className="mt-1 text-base text-gray-500 flex">
                    <span className="mr-1">≈</span>
                    {balance}
                    <span className="ml-1">{symbol}</span>
                  </div>
                )}
              </InFiat>
            </div>
          )}
        </Balance>
      </div>
    </div>
  );
});
>>>>>>> master:src/app/pages/Home/OtherComponents/MainBanner/index.tsx
