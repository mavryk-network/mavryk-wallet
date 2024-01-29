import React, { FC, useCallback, useState } from 'react';

import classNames from 'clsx';

import { Button } from 'app/atoms/Button';
import Identicon from 'app/atoms/Identicon';
import { useAppEnv } from 'app/env';
import ContentContainer from 'app/layouts/ContentContainer';
import { OpenInExplorerChip } from 'app/templates/OpenInExplorerChip';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T, t } from 'lib/i18n';
import { useAccount, useTempleClient } from 'lib/temple/front';
import Popper from 'lib/ui/Popper';

import styles from './Header.module.css';
import { HeaderSelectors } from './Header.selectors';
import AccountDropdown from './Header/AccountDropdown';
import { AccountPopupButton, GetProlabel } from './Header/AccountPopup/AccountPopupButton';
import { DAapsDropdownButton } from './Header/DAapsPopup/DAapsDropdownButton';
import { DAppsPopup, DappsContext } from './Header/DAapsPopup/DAppsPopup';
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
          <div className="flex items-center" style={{ maxHeight: 56 }}>
            {ready && <Control />}
          </div>
        </div>
      </ContentContainer>
    </header>
  );
};

export default Header;

const Control: FC = () => {
  const account = useAccount();

  // popup states
  const [showDAppsPopup, setShowDAppsPopup] = useState(false);
  const [showNetworkPopup, setShowNetworkPopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);

  const handlePopupToggle = useCallback((popupFunction: (v: boolean) => void, popupValue: boolean) => {
    popupFunction(popupValue);
  }, []);

  return (
    <DappsContext>
      {/* TODO DO NOT REMOVE THIS CODE FOR NOW */}
      {/* <Popper
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
      </Popper> */}

      <AccountPopupButton account={account} child={<GetProlabel />} />

      <div className="ml-2 flex-1 flex items-start">
        <div className="flex-1" />
        <div className="flex item gap-2 items-center">
          <DAapsDropdownButton onClick={handlePopupToggle.bind(null, setShowDAppsPopup, true)} />
          <NetworkButton onClick={handlePopupToggle.bind(null, setShowNetworkPopup, true)} />
          <SettingButton onClick={handlePopupToggle.bind(null, setShowSettingsPopup, true)} />
        </div>
      </div>

      {/* ________popups ________ */}
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
        <SettingsPopup closePopup={handlePopupToggle.bind(null, setShowSettingsPopup, false)} />
      </PopupModalWithTitle>
    </DappsContext>
  );
};
