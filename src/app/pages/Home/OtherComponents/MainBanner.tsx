import React, { memo, FC } from 'react';

import BigNumber from 'bignumber.js';
import classNames from 'clsx';
// import { useDispatch } from 'react-redux';

// import { Button } from 'app/atoms';
import Money from 'app/atoms/Money';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
// import { toggleBalanceModeAction } from 'app/store/settings/actions';
import { useBalanceModeSelector } from 'app/store/settings/selectors';
import { BalanceMode } from 'app/store/settings/state';
import AddressChip from 'app/templates/AddressChip';
import { AssetIcon } from 'app/templates/AssetIcon';
import Balance from 'app/templates/Balance';
import InFiat from 'app/templates/InFiat';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { useFiatCurrency } from 'lib/fiat-currency';
// import { t } from 'lib/i18n';
// import { TezosLogoIcon } from 'lib/icons';
import { getAssetName, getAssetSymbol, useAssetMetadata } from 'lib/metadata';
import { useGasToken, useNetwork } from 'lib/temple/front';
import { useTotalBalance } from 'lib/temple/front/use-total-balance.hook';
// import useTippy from 'lib/ui/useTippy';

import { HomeSelectors } from '../Home.selectors';
import styles from './MainBanner.module.css';
import { TokenPageSelectors } from './TokenPage.selectors';

interface Props {
  assetSlug?: string | null;
  accountPkh: string;
}

const MainBanner = memo<Props>(({ assetSlug, accountPkh }) => {
  return assetSlug ? (
    <AssetBanner assetSlug={assetSlug ?? 'tez'} accountPkh={accountPkh} />
  ) : (
    <TotalVolumeBanner accountPkh={accountPkh} />
  );
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
  // const dispatch = useDispatch();
  const network = useNetwork();
  const { totalBalanceInFiat, totalBalanceInGasToken } = useTotalBalance();
  const balanceMode = useBalanceModeSelector();

  const {
    // selectedFiatCurrency: { name: fiatName, symbol: fiatSymbol }
    selectedFiatCurrency: { symbol: fiatSymbol }
  } = useFiatCurrency();

  const {
    // metadata: { name: gasTokenName, symbol: gasTokenSymbol }
    metadata: { symbol: gasTokenSymbol }
  } = useGasToken();

  // const tippyProps = useMemo(
  //   () => ({
  //     trigger: 'mouseenter',
  //     hideOnClick: false,
  //     content: t('showInGasOrFiat', [fiatName, gasTokenSymbol]),
  //     animation: 'shift-away-subtle'
  //   }),
  //   []
  // );

  // const buttonRef = useTippy<HTMLButtonElement>(tippyProps);

  // const nextBalanceMode = balanceMode === BalanceMode.Fiat ? BalanceMode.Gas : BalanceMode.Fiat;

  // const handleTvlModeToggle = () => dispatch(toggleBalanceModeAction(nextBalanceMode));

  const isMainNetwork = network.type === 'main';
  const isFiatMode = balanceMode === BalanceMode.Fiat;
  const shouldShowFiatBanner = isMainNetwork && isFiatMode;

  return (
    <div className="flex flex-col justify-between items-start">
      <div className="flex items-center text-3xl-plus">
        {shouldShowFiatBanner ? (
          <BalanceFiat volume={totalBalanceInFiat} currency={fiatSymbol} />
        ) : (
          <BalanceGas volume={totalBalanceInGasToken} currency={gasTokenSymbol} />
        )}
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

const BalanceGas: FC<BalanceProps> = ({ volume, currency }) => (
  <>
    <Money smallFractionFont={false}>{volume}</Money>
    <span className="ml-1">{currency}</span>
  </>
);

interface AssetBannerProps {
  assetSlug: string;
  accountPkh: string;
}

const AssetBanner: FC<AssetBannerProps> = ({ assetSlug, accountPkh }) => {
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
};
