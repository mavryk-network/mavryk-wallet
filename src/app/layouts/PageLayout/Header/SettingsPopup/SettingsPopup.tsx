import React, { FC, useCallback, useMemo, useState } from 'react';

import clsx from 'clsx';

import { Anchor } from 'app/atoms';
import { ListItemDivider } from 'app/atoms/Divider';
import { openInFullPage, useAppEnv } from 'app/env';
import { ReactComponent as BlocksSvgIcon } from 'app/icons/blocks.svg';
import { ReactComponent as ExitSvgIcon } from 'app/icons/exit.svg';
import { ReactComponent as ExtendSvgIcon } from 'app/icons/extend.svg';
import { ReactComponent as LinkSvgIcon } from 'app/icons/external-link.svg';
import { ReactComponent as SettingsScgIcon } from 'app/icons/settings.svg';
import { ReactComponent as SupportSvgIcon } from 'app/icons/support.svg';
import { ListItemWithNavigate, ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';
import { DropdownSelect } from 'app/templates/DropdownSelect/DropdownSelect';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { useAccount, useTempleClient } from 'lib/temple/front';
import { translateYModifiers } from 'lib/ui/general-modifiers';
import { Link } from 'lib/woozie';

import { AccountDetailsPopup } from './components/AccountDetails';
import { SettingButton } from './SettingButton';

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

// ------------------- Desktop view -----------------------

export const SettingsDropdown: FC = () => {
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
      // closePopup();
    }
  }, [appEnv.popup]);

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
        i18nKey: 'viewOnBlockExplorer'
        // onClick: closePopup
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
        i18nKey: 'support'
        // onClick: closePopup
      },
      {
        key: 'settings',
        linkTo: '/settings',
        Icon: SettingsScgIcon,
        i18nKey: 'settings'
        // onClick: closePopup
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
    [handleLogoutClick, handleMaximiseViewClick, publicKeyHash, toggleAccountPopup]
  );

  return (
    <>
      <DropdownSelect
        dropdownWrapperClassName={clsx('border border-divider bg-primary-card rounded-2xl-plus w-auto')}
        optionsListClassName="bg-primary-card w-auto py-2"
        dropdownButtonClassName="bg-transparent gap-0 w-auto"
        fontContentWrapperClassname="border-none bg-transparent"
        DropdownFaceContent={<SettingButton onClick={() => console.log('clicked')} />}
        showIcon={false}
        poperModifiers={translateYModifiers}
        poperPlacement="bottom-end"
        optionsProps={{
          options: settingsListData,
          getKey: option => option.i18nKey,
          noItemsText: 'No Items',
          renderOptionContent: option => renderOptionContent(option, option.i18nKey === 'logout'),
          onOptionChange: option => option.onClick?.()
        }}
      />

      <PopupModalWithTitle
        isOpen={showAccountsPopup}
        onRequestClose={toggleAccountPopup}
        title="selectAccount"
        portalClassName="accounts-popup"
      >
        <AccountDetailsPopup showAccountsPopup={showAccountsPopup} toggleAccountPopup={toggleAccountPopup} />
      </PopupModalWithTitle>
    </>
  );
};

const renderOptionContent = (
  { Icon, i18nKey, linkTo, fillIcon, hasExternalLink }: ListItemWithNavigateprops,
  last: boolean
) => {
  const itemProps = {
    className: clsx(
      'relative p-4 hover:bg-gray-710 text-base-plus text-white text-left w-full',
      'bg-primary-card flex'
    ),
    children: (
      <div className="w-full">
        <div className="flex items-center w-full">
          {Icon && <Icon className={clsx('w-6 h-6 mr-2', 'fill-white')} />}
          <span className="text-base-plus text-white display-block">
            <T id={i18nKey} />
          </span>
        </div>
        {!last && <ListItemDivider />}
      </div>
    )
  };

  if (hasExternalLink && linkTo) {
    return <Anchor href={linkTo} {...itemProps} />;
  }

  return linkTo ? <Link to={linkTo} {...itemProps} /> : <div {...itemProps} />;
};
