import React, { FC, useCallback, useState } from 'react';

import classNames from 'clsx';

import { useAppEnv } from 'app/env';
import ContentContainer from 'app/layouts/ContentContainer';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { useAccount, useBlockExplorer, useTempleClient } from 'lib/temple/front';

import { AccountPopupButton } from './Header/AccountPopup/AccountPopupButton';
import { DAapsDropdownButton } from './Header/DAapsPopup/DAapsDropdownButton';
import { DAppsPopup, DappsContext } from './Header/DAapsPopup/DAppsPopup';
import { GetProlabel } from './Header/GetProButton';
import { NetworkButton } from './Header/NetworkPopup/NetworkButton';
import { NetworkPopup } from './Header/NetworkPopup/NetworkPopup';
import { SettingButton, SettingsDropdown, SettingsPopup } from './Header/SettingsPopup';
import styles from './Header.module.css';

const Header: FC = () => {
  const { fullPage } = useAppEnv();
  const { ready } = useTempleClient();

  return (
    <header className={classNames(styles['inner-shadow'], fullPage && 'pb-20 -mb-20 max-w-screen-xs mx-auto')}>
      <ContentContainer className="py-3 bg-primary-card">
        <div>
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
  const { popup } = useAppEnv();

  // popup states
  const [showDAppsPopup, setShowDAppsPopup] = useState(false);
  const [showNetworkPopup, setShowNetworkPopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);

  // preload networks for networks modal (if u remove this line, the modal wont be opened)
  useBlockExplorer();

  const handlePopupToggle = useCallback((popupFunction: (v: boolean) => void, popupValue: boolean) => {
    popupFunction(popupValue);
  }, []);

  return (
    <DappsContext>
      <AccountPopupButton iconSize={34} account={account} child={<GetProlabel />} />

      <div className="ml-2 flex-1 flex items-start">
        <div className="flex-1" />
        <div className="flex item gap-2 items-center">
          <DAapsDropdownButton onClick={handlePopupToggle.bind(null, setShowDAppsPopup, true)} />
          <NetworkButton onClick={handlePopupToggle.bind(null, setShowNetworkPopup, true)} />
          {popup ? (
            <SettingButton onClick={handlePopupToggle.bind(null, setShowSettingsPopup, true)} />
          ) : (
            <SettingsDropdown />
          )}
        </div>
      </div>

      {/* ________popups ________ */}
      {/* connected dapps */}
      <PopupModalWithTitle
        isOpen={showDAppsPopup}
        onRequestClose={handlePopupToggle.bind(null, setShowDAppsPopup, false)}
        title={<T id="connectedSites" />}
        contentPosition={popup ? 'bottom' : 'center'}
        portalClassName="daaps-popup"
      >
        <DAppsPopup opened={showDAppsPopup} setOpened={setShowDAppsPopup} />
      </PopupModalWithTitle>
      {/* networks */}
      <PopupModalWithTitle
        isOpen={showNetworkPopup}
        onRequestClose={handlePopupToggle.bind(null, setShowNetworkPopup, false)}
        title={<T id="networkSelect" />}
        portalClassName="networks-popup"
        contentPosition={popup ? 'bottom' : 'center'}
      >
        <NetworkPopup setOpened={setShowNetworkPopup} />
      </PopupModalWithTitle>

      {popup && (
        <PopupModalWithTitle
          isOpen={showSettingsPopup}
          onRequestClose={handlePopupToggle.bind(null, setShowSettingsPopup, false)}
          portalClassName="settings-popup"
        >
          <SettingsPopup closePopup={handlePopupToggle.bind(null, setShowSettingsPopup, false)} />
        </PopupModalWithTitle>
      )}
    </DappsContext>
  );
};
