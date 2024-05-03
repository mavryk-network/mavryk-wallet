import React from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import { ReactComponent as BuyIcon } from 'app/icons/buy.svg';
import { ReactComponent as ReceiveIcon } from 'app/icons/m_receive.svg';
import { ReactComponent as SendIcon } from 'app/icons/m_send.svg';
import { ReactComponent as SwapIcon } from 'app/icons/m_swap.svg';
import { ReactComponent as WithdrawIcon } from 'app/icons/m_withdraw.svg';
import { ActionButton } from 'app/pages/Home/Home';
import { HomeSelectors } from 'app/pages/Home/Home.selectors';
import { T, t } from 'lib/i18n';
import { useAccount, useNetwork } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';

export const tippyPropsMock = {
  trigger: 'mouseenter',
  hideOnClick: false,
  content: t('disabledForWatchOnlyAccount'),
  animation: 'shift-away-subtle'
};

export const ActionsBlock = ({ assetSlug }: { assetSlug?: string }) => {
  const { fullPage } = useAppEnv();
  const account = useAccount();
  const network = useNetwork();

  const canSend = account.type !== TempleAccountType.WatchOnly;
  const sendLink = assetSlug ? `/send/${assetSlug}` : '/send';

  return (
    <div className={clsx('flex justify-between mx-auto w-full pb-4', !fullPage ? 'max-w-sm' : 'px-4.5')}>
      <ActionButton label={<T id="receive" />} Icon={ReceiveIcon} to="/receive" testID={HomeSelectors.receiveButton} />

      <ActionButton
        label={<T id="buyButton" />}
        Icon={BuyIcon}
        to={network.type === 'dcp' ? 'https://buy.chainbits.com' : '/buy'}
        isAnchor={network.type === 'dcp'}
        // disabled={!NETWORK_TYPES_WITH_BUY_BUTTON.includes(network.type)}
        disabled
        testID={HomeSelectors.buyButton}
      />
      <ActionButton
        label={<T id="swap" />}
        Icon={SwapIcon}
        to={{
          pathname: '/swap',
          search: `from=${assetSlug ?? ''}`
        }}
        // disabled={!canSend}
        disabled
        testID={HomeSelectors.swapButton}
      />
      <ActionButton
        label={<T id="withdraw" />}
        Icon={WithdrawIcon}
        to="/withdraw"
        // disabled={!canSend || network.type !== 'main'}
        disabled
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
  );
};
