import React, { FC } from 'react';

import { ReactComponent as BuyIcon } from 'app/icons/buy.svg';
import { ReactComponent as ConfirmedIcon } from 'app/icons/confirmed.svg';
import { ReactComponent as ReceiveIcon } from 'app/icons/m_receive.svg';
import { ReactComponent as SendIcon } from 'app/icons/m_send.svg';
import { ReactComponent as SwapIcon } from 'app/icons/m_swap.svg';
import { ReactComponent as WithdrawIcon } from 'app/icons/m_withdraw.svg';
import { ActionButton, NETWORK_TYPES_WITH_BUY_BUTTON, tippyPropsMock } from 'app/pages/Home/Home';
import { HomeSelectors } from 'app/pages/Home/Home.selectors';
import { AssetIcon } from 'app/templates/AssetIcon';
import { PopupModalWithTitle, PopupModalWithTitlePropsProps } from 'app/templates/PopupModalWithTitle';
import { TEZ_TOKEN_SLUG } from 'lib/assets';
import { T, t } from 'lib/i18n';
import { AssetMetadataBase, getAssetSymbol, useAssetMetadata } from 'lib/metadata';
import { useAccount, useNetwork } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';

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
      headerComponent={<AssetIcon assetSlug={assetSlug} className="rounded-full" style={{ width: 44, height: 44 }} />}
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

  const assetSymbol = getAssetSymbol(assetMetadata);

  // derived states
  const accountPkh = account.publicKeyHash;
  const canSend = account.type !== TempleAccountType.WatchOnly;
  const sendLink = assetSlug ? `/send/${assetSlug}` : '/send';

  return (
    <div className="text-white text-bae-plus">
      <div className="flex justify-between mx-auto w-full max-w-sm pb-4">
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
  );
};
