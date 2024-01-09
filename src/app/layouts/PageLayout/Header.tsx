import React, { FC, useCallback, useState } from 'react';

import classNames from 'clsx';

import { Button } from 'app/atoms/Button';
import Identicon from 'app/atoms/Identicon';
import Name from 'app/atoms/Name';
import { useAppEnv } from 'app/env';
import ContentContainer from 'app/layouts/ContentContainer';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { useTempleClient, useAccount, useNetwork } from 'lib/temple/front';
import Popper from 'lib/ui/Popper';

import styles from './Header.module.css';
import { HeaderSelectors } from './Header.selectors';
import AccountDropdown from './Header/AccountDropdown';
import AccountPopup from './Header/AccountPopup';
import { DAapsDropdownButton } from './Header/DAapsPopup/DAapsDropdownButton';
import { DAppsPopup } from './Header/DAapsPopup/DAppsPopup';
import { NetworkButton } from './Header/NetworkPopup/NetworkButton';
import { NetworkPopup } from './Header/NetworkPopup/NetworkPopup';
import { SettingButton, SettingsPopup } from './Header/SettingsPopup';

const Header: FC = () => {
  const appEnv = useAppEnv();
  const { ready } = useTempleClient();

  return (
    <header className={classNames('bg-primary-card', styles['inner-shadow'], appEnv.fullPage && 'pb-20 -mb-20')}>
      <ContentContainer className="py-3">
        <div className={classNames(appEnv.fullPage && 'px-4')}>
          <div className="flex items-center">{ready && <Control />}</div>
        </div>
      </ContentContainer>
    </header>
  );
};

export default Header;

const Control: FC = () => {
  const account = useAccount();
  const currentNetwork = useNetwork();

  // popup states
  const [showAccountsPopup, setShowAccountsPopup] = useState(false);
  const [showDAppsPopup, setShowDAppsPopup] = useState(false);
  const [showNetworkPopup, setShowNetworkPopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);

  const handlePopupToggle = useCallback((popupFunction: (v: boolean) => void, popupValue: boolean) => {
    popupFunction(popupValue);
  }, []);

  return (
    <>
      {/* TODO DO NOT REMOVE THIS CODE FOR NOW */}
      <Popper
        placement="left-start"
        strategy="fixed"
        style={{ pointerEvents: 'none' }}
        popup={props => <AccountDropdown {...props} />}
      >
        {({ ref, opened, toggleOpened }) => (
          <Button
            ref={ref}
            className={classNames(
              'flex-shrink-0 flex p-px',
              'rounded-full',
              'bg-primary-bg bg-opacity-10 cursor-pointer',
              'transition ease-in-out duration-200',
              opened
                ? 'shadow-md opacity-100'
                : 'shadow hover:shadow-md focus:shadow-md opacity-90 hover:opacity-100 focus:opacity-100'
            )}
            onClick={toggleOpened}
            testID={HeaderSelectors.accountIcon}
          >
            <Identicon type="bottts" hash={account.publicKeyHash} size={48} />
          </Button>
        )}
      </Popper>

      <Button
        className={classNames(
          'flex-shrink-0 flex self-center',
          'rounded-full overflow-hidden',
          'bg-primary-bg bg-opacity-10 cursor-pointer',
          'transition ease-in-out duration-200'
        )}
        testID={HeaderSelectors.accountIcon}
        onClick={handlePopupToggle.bind(null, setShowAccountsPopup, true)}
      >
        <Identicon type="bottts" hash={account.publicKeyHash} size={24} />
      </Button>

      <div className="ml-2 flex-1 flex items-start">
        <div className="max-w-full overflow-x-hidden">
          <Name className="text-primary-white text-sm font-semibold text-shadow-black opacity-90">{account.name}</Name>
        </div>

        <div className="flex-1" />
        <div className="flex item gap-2 items-center">
          <NetworkButton
            enabled={Boolean(currentNetwork)}
            onClick={handlePopupToggle.bind(null, setShowNetworkPopup, true)}
          />
          <DAapsDropdownButton onClick={handlePopupToggle.bind(null, setShowDAppsPopup, true)} />
          <SettingButton onClick={handlePopupToggle.bind(null, setShowSettingsPopup, true)} />
        </div>
      </div>

      {/* ________popups ________ */}
      {/* accounts */}
      <PopupModalWithTitle
        isOpen={showAccountsPopup}
        onRequestClose={handlePopupToggle.bind(null, setShowAccountsPopup, false)}
        title={<T id="selectAccount" />}
        portalClassName="accounts-popup"
      >
        <AccountPopup opened={showAccountsPopup} setOpened={setShowAccountsPopup} />
      </PopupModalWithTitle>
      {/* connected dapps */}
      <PopupModalWithTitle
        isOpen={showDAppsPopup}
        onRequestClose={handlePopupToggle.bind(null, setShowDAppsPopup, false)}
        title={<T id="connectedSites" />}
        portalClassName="daaps-popup"
      >
        <DAppsPopup opened={showDAppsPopup} setOpened={setShowDAppsPopup} />
      </PopupModalWithTitle>
      {/* networks */}
      <PopupModalWithTitle
        isOpen={showNetworkPopup}
        onRequestClose={handlePopupToggle.bind(null, setShowNetworkPopup, false)}
        title={<T id="networkSelect" />}
        portalClassName="network-popup"
      >
        <NetworkPopup opened={showNetworkPopup} setOpened={setShowNetworkPopup} />
      </PopupModalWithTitle>

      <PopupModalWithTitle
        isOpen={showSettingsPopup}
        onRequestClose={handlePopupToggle.bind(null, setShowSettingsPopup, false)}
        portalClassName="settings-popup"
      >
        <SettingsPopup setOpened={setShowSettingsPopup} />
      </PopupModalWithTitle>
    </>
  );
};
