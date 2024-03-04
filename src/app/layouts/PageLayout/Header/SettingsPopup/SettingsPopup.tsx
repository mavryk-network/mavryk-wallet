import React, { FC, useCallback, useMemo } from 'react';

import { openInFullPage, useAppEnv } from 'app/env';
import { ReactComponent as BlocksSvgIcon } from 'app/icons/blocks.svg';
import { ReactComponent as ExitSvgIcon } from 'app/icons/exit.svg';
import { ReactComponent as ExtendSvgIcon } from 'app/icons/extend.svg';
import { ReactComponent as LinkSvgIcon } from 'app/icons/external-link.svg';
import { ReactComponent as SettingsScgIcon } from 'app/icons/settings.svg';
import { ReactComponent as SupportSvgIcon } from 'app/icons/support.svg';
import { ListItemWithNavigate, ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';
import { useAccount, useTempleClient } from 'lib/temple/front';

type SettingsPopupProps = {
  closePopup: () => void;
};

export const SettingsPopup: FC<SettingsPopupProps> = ({ closePopup }) => {
  const appEnv = useAppEnv();
  const { publicKeyHash } = useAccount();
  const { lock } = useTempleClient();

  const handleLogoutClick = useCallback(() => {
    lock();
  }, [lock]);

  const handleMaximiseViewClick = useCallback(() => {
    openInFullPage();
    if (appEnv.popup) {
      window.close();
    } else {
      closePopup();
    }
  }, [appEnv.popup, closePopup]);

  const settingsListData: ListItemWithNavigateprops[] = useMemo(
    () => [
      {
        key: 'accountDetails',
        linkTo: '/temp',
        Icon: BlocksSvgIcon,
        i18nKey: 'accountDetails',
        onClick: closePopup
      },
      {
        key: 'viewOnBlockExplorer',
        linkTo: `https://ghost.tzstats.com/${publicKeyHash}`,
        hasExternalLink: true,
        Icon: LinkSvgIcon,
        i18nKey: 'viewOnBlockExplorer',
        onClick: closePopup
      },
      {
        key: 'expandView',
        linkTo: null,
        Icon: ExtendSvgIcon,
        i18nKey: 'expandView',
        onClick: handleMaximiseViewClick
      },
      {
        key: 'support',
        linkTo: '/settings/about',
        Icon: SupportSvgIcon,
        i18nKey: 'support',
        onClick: closePopup
      },
      {
        key: 'settings',
        linkTo: '/settings',
        Icon: SettingsScgIcon,
        i18nKey: 'settings',
        onClick: closePopup
      },
      {
        key: 'logout',
        linkTo: null,
        Icon: ExitSvgIcon,
        i18nKey: 'logout',
        onClick: handleLogoutClick,
        showDivider: false
      }
    ],
    [closePopup, handleLogoutClick, handleMaximiseViewClick, publicKeyHash]
  );
  return (
    <div className="text-white mt-6 flex flex-col">
      {settingsListData.map(item => (
        <ListItemWithNavigate {...item} />
      ))}
    </div>
  );
};
