import React, { FC, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import { Alert, HashChip, Money } from 'app/atoms';
import { DARK_LIGHT_THEME } from 'app/consts/appTheme';
import { useBalancesWithDecimals } from 'app/hooks/use-balances-with-decimals.hook';
import { ReactComponent as BuyIcon } from 'app/icons/buy.svg';
import { ReactComponent as ConfirmedIcon } from 'app/icons/confirmed.svg';
import { ReactComponent as ReceiveIcon } from 'app/icons/m_receive.svg';
import { ReactComponent as SendIcon } from 'app/icons/m_send.svg';
import { ReactComponent as SwapIcon } from 'app/icons/m_swap.svg';
import { ReactComponent as WithdrawIcon } from 'app/icons/m_withdraw.svg';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { ActionButton, NETWORK_TYPES_WITH_BUY_BUTTON, tippyPropsMock } from 'app/pages/Home/Home';
import { HomeSelectors } from 'app/pages/Home/Home.selectors';
import { useTokenMetadataSelector } from 'app/store/tokens-metadata/selectors';
import { AssetIcon } from 'app/templates/AssetIcon';
import BakerBanner from 'app/templates/BakerBanner';
import { HistoryComponent } from 'app/templates/History/History';
import InFiat from 'app/templates/InFiat';
import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from 'app/templates/PopupModalWithTitle';
import { TEZ_TOKEN_SLUG } from 'lib/assets';
import { useAssetFiatCurrencyPrice } from 'lib/fiat-currency';
import { T, t } from 'lib/i18n';
import { AssetMetadataBase, getAssetSymbol, useAssetMetadata } from 'lib/metadata';
import { useAccount, useDelegate, useNetwork } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { navigate } from 'lib/woozie';

import styles from '../../Tokens.module.css';
import { FiatBalance } from '../Balance';

type TokenDetailsPopupProps = {
  assetSlug: string;
} & PopupModalWithTitlePropsProps;

export const TokenDetailsPopup: FC<TokenDetailsPopupProps> = ({ assetSlug, isOpen, ...rest }) => {
  const assetMetadata = useAssetMetadata(assetSlug || TEZ_TOKEN_SLUG);

  return (
    <PopupModalWithTitle
      isOpen={isOpen}
      title={
        <div className="flex items-center gap-1">
          <span>{assetMetadata?.name ?? t('someUnknownToken')}</span>
          {assetSlug === 'tez' && <ConfirmedIcon />}
        </div>
      }
      portalClassName="token-details-popup"
      headerComponent={
        <AssetIcon assetSlug={assetSlug} className="rounded-full" size={44} style={{ width: 44, height: 44 }} />
      }
      {...rest}
    >
      <TokenDetailsPopupContent assetSlug={assetSlug} assetMetadata={assetMetadata} />
    </PopupModalWithTitle>
  );
};

type TokenDetailsPopupContentProps = {
  assetSlug: string;
  assetMetadata: AssetMetadataBase | undefined;
};

const TokenDetailsPopupContent: FC<TokenDetailsPopupContentProps> = ({ assetSlug, assetMetadata }) => {
  const account = useAccount();
  const network = useNetwork();
  const balances = useBalancesWithDecimals();
  const balance = useMemo(() => balances[assetSlug] ?? new BigNumber(0), [assetSlug, balances]);
  const price = useAssetFiatCurrencyPrice(assetSlug ?? 'tez');
  const tokenMetadata = useTokenMetadataSelector(assetSlug);

  const assetSymbol = getAssetSymbol(assetMetadata);
  const isMainToken = assetSlug === TEZ_TOKEN_SLUG;

  // derived states
  const accountPkh = account.publicKeyHash;
  const canSend = account.type !== TempleAccountType.WatchOnly;
  const sendLink = assetSlug ? `/send/${assetSlug}` : '/send';

  const { data: myBakerPkh } = useDelegate(accountPkh);

  return (
    <section>
      <div className="px-4">
        {/* balances section */}
        <div className="flex flex-col items-center gap-1 mt-2 mb-6">
          <InFiat assetSlug={assetSlug} volume={balance} smallFractionFont={false}>
            {({ balance, symbol }) => (
              <div className="ml-1 font-normal text-white text-3xl-plus flex items-center truncate text-right">
                <span>{symbol}</span>
                {balance}
              </div>
            )}
          </InFiat>
          <div className="text-white text-sm flex items-center">
            <Money smallFractionFont={false}>{balance}</Money>
            <span>&nbsp;</span>
            <span>{assetSymbol}</span>
          </div>
        </div>
        {/* send swap receive withdraw - section */}
        <div className="text-base-plus text-white mb-2">
          <div className="flex justify-between mx-auto w-full max-w-sm pb-4 px-2">
            <ActionButton
              label={<T id="receive" />}
              Icon={ReceiveIcon}
              to="/receive"
              testID={HomeSelectors.receiveButton}
            />

            <ActionButton
              label={<T id="buyButton" />}
              Icon={BuyIcon}
              to={network.type === 'dcp' ? 'https://buy.chainbits.com' : '/buy'}
              isAnchor={network.type === 'dcp'}
              disabled={!NETWORK_TYPES_WITH_BUY_BUTTON.includes(network.type)}
              testID={HomeSelectors.buyButton}
            />
            <ActionButton
              label={<T id="swap" />}
              Icon={SwapIcon}
              to={{
                pathname: '/swap',
                search: `from=${assetSlug ?? ''}`
              }}
              disabled={!canSend}
              tippyProps={tippyPropsMock}
              testID={HomeSelectors.swapButton}
            />
            <ActionButton
              label={<T id="withdraw" />}
              Icon={WithdrawIcon}
              to="/withdraw"
              disabled={!canSend || network.type !== 'main'}
              testID={HomeSelectors.withdrawButton}
            />
            <ActionButton
              label={<T id="send" />}
              Icon={SendIcon}
              to={sendLink}
              disabled={!canSend}
              tippyProps={tippyPropsMock}
              testID={HomeSelectors.sendButton}
            />
          </div>
        </div>
        {/* market price section */}
        <div className="flex flex-col gap-3 mb-6 text-white text-base-plus">
          <T id="marketPrice" />
          <div className="p-4 bg-gray-910 text-left rounded-2xl-plus">
            <FiatBalance value={price} assetSlug={assetSlug} className="text-white text-base-plus" />
          </div>
        </div>
        {/* staking section */}
        {isMainToken ? (
          <BakerBannerSection myBakerPkh={myBakerPkh} />
        ) : tokenMetadata?.address ? (
          <div className="flex flex-col gap-3 mb-6 text-white text-base-plus">
            <T id="tokenAddress" />
            <div className="p-4 bg-gray-920 text-left rounded-2xl-plus">
              <HashChip hash={tokenMetadata.address} small />
            </div>
          </div>
        ) : null}
      </div>
      <div className="text-base-plus text-white w-full px-4">
        <T id="history" />
      </div>
      <HistoryComponent
        assetSlug={assetSlug}
        searchWrapperClassname={styles.searchWrapperPopup}
        theme={DARK_LIGHT_THEME}
      />
    </section>
  );
};

type BakerBannerSectionProps = {
  myBakerPkh: string | undefined | null;
};

const BakerBannerSection: FC<BakerBannerSectionProps> = ({ myBakerPkh }) => {
  const handleButtonClick = useCallback(() => {
    navigate('/stake');
  }, []);

  const NotStakedBanner = useMemo(
    () => (
      <div className="p-4 flex flex-col gap-6 rounded-2xl-plus bg-accent-blue-hover">
        <div className="text-white text-sm">
          <T id="stakeYourTokensBannerDescription" />
        </div>
        <ButtonRounded size="big" fill onClick={handleButtonClick} className="w-full">
          <T id="stake" />
        </ButtonRounded>
      </div>
    ),
    [handleButtonClick]
  );

  const StakedBanner = useMemo(
    () =>
      myBakerPkh ? (
        <BakerBanner
          bakerPkh={myBakerPkh ?? ''}
          displayAddress
          displayDivider
          alternativeTableData
          displayBg
          style={{ width: undefined }}
        />
      ) : (
        <Alert type="warning" title={t('unknownBakerTitle')} description={t('unknownBakerDescription')} />
      ),
    [myBakerPkh]
  );

  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="text-white text-base-plus flex items-center justify-between">
        <T id="staking" />
        {myBakerPkh && (
          <ButtonRounded fill={false} size="xs" onClick={handleButtonClick}>
            <T id="reStake" />
          </ButtonRounded>
        )}
      </div>
      {myBakerPkh ? StakedBanner : NotStakedBanner}
    </div>
  );
};
