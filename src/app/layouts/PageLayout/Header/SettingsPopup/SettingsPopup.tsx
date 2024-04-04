import React, { FC, useCallback, useMemo, useState } from 'react';

import { openInFullPage, useAppEnv } from 'app/env';
import { ReactComponent as BlocksSvgIcon } from 'app/icons/blocks.svg';
import { ReactComponent as ExitSvgIcon } from 'app/icons/exit.svg';
import { ReactComponent as ExtendSvgIcon } from 'app/icons/extend.svg';
import { ReactComponent as LinkSvgIcon } from 'app/icons/external-link.svg';
import { ReactComponent as SettingsScgIcon } from 'app/icons/settings.svg';
import { ReactComponent as SupportSvgIcon } from 'app/icons/support.svg';
import { ListItemWithNavigate, ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { useAccount, useTempleClient } from 'lib/temple/front';

import { AccountDetailsPopup } from './components/AccountDetails';

type SettingsPopupProps = {
  closePopup: () => void;
};

export const SettingsPopup: FC<SettingsPopupProps> = ({ closePopup }) => {
  const appEnv = useAppEnv();
  const { publicKeyHash } = useAccount();
  const { lock } = useTempleClient();

  const [showAccountsPopup, setShowAccountsPopup] = useState(false);

  const toggleAccountPopup = useCallback(() => {
    setShowAccountsPopup(!showAccountsPopup);
  }, [showAccountsPopup]);

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
        linkTo: null,
        Icon: BlocksSvgIcon,
        i18nKey: 'accountDetails',
        onClick: toggleAccountPopup
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
        onClick: undefined
        // onClick: handleMaximiseViewClick,
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
    [closePopup, handleLogoutClick, handleMaximiseViewClick, publicKeyHash, toggleAccountPopup]
  );
  return (
    <div className="text-white mt-6 flex flex-col">
      {settingsListData.map(item => (
        <ListItemWithNavigate {...item} />
      ))}
      {/* Popup modal for account details list item */}
      <PopupModalWithTitle
        isOpen={showAccountsPopup}
        onRequestClose={toggleAccountPopup}
        title="selectAccount"
        portalClassName="accounts-popup"
      >
        <AccountDetailsPopup showAccountsPopup={showAccountsPopup} toggleAccountPopup={toggleAccountPopup} />
      </PopupModalWithTitle>
    </div>
  );
};
