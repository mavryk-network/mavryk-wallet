import React from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import { ReactComponent as ReceiveIcon } from 'app/icons/m_receive.svg';
import { ReactComponent as SendIcon } from 'app/icons/m_send.svg';
import { ActionButton } from 'app/pages/Home/Home';
import { HomeSelectors } from 'app/pages/Home/Home.selectors';
import { T, t } from 'lib/i18n';
import { useAccount } from 'lib/temple/front';
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

  const canSend = account.type !== TempleAccountType.WatchOnly;
  const sendLink = assetSlug ? `/send/${assetSlug}` : '/send';

  return (
    <div className={clsx('flex justify-around mx-auto w-full pb-4', !fullPage ? 'max-w-sm' : 'px-4.5')}>
      <ActionButton label={<T id="receive" />} Icon={ReceiveIcon} to="/receive" testID={HomeSelectors.receiveButton} />
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
