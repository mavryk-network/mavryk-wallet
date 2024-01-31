import React, { FC, useCallback, useState } from 'react';

import classNames from 'clsx';

import { Button, Identicon, Name } from 'app/atoms';
import { ReactComponent as ArrowDownicon } from 'app/icons/chevron-down.svg';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T } from 'lib/i18n';
import { TempleAccount } from 'lib/temple/types';

import AccountPopup from '.';

export type AccountButtonProps = {
  child?: JSX.Element;
  iconSize?: number;
  account: TempleAccount;
  onlyAccSelect?: boolean;
};

export enum AccountSelectors {
  templeLogoIcon = 'Header/Temple Logo Icon',
  accountIcon = 'Header/Account Icon'
}

export const AccountPopupButton: FC<AccountButtonProps> = ({
  account,
  child,
  iconSize = 24,
  onlyAccSelect = false
}) => {
  const [showAccountsPopup, setShowAccountsPopup] = useState(false);

  const handlePopupToggle = useCallback((popupFunction: (v: boolean) => void, popupValue: boolean) => {
    popupFunction(popupValue);
  }, []);

  return (
    <div className="flex gap-2">
      <Button
        className={classNames(
          'flex-shrink-0 flex self-center',
          'rounded-full overflow-hidden',
          'bg-primary-bg bg-opacity-10 cursor-pointer',
          'transition ease-in-out duration-200'
        )}
        testID={AccountSelectors.accountIcon}
        onClick={handlePopupToggle.bind(null, setShowAccountsPopup, true)}
      >
        <Identicon type="bottts" hash={account.publicKeyHash} size={iconSize} />
      </Button>

      <div className="flex flex-col items-start">
        <div
          className="max-w-full overflow-x-hidden cursor-pointer flex items-center"
          onClick={handlePopupToggle.bind(null, setShowAccountsPopup, true)}
        >
          <Name className="text-primary-white text-base-plus">{account.name}</Name>
          <ArrowDownicon className="stroke stroke-2 stroke-white w-4 h-auto ml-1" />
        </div>
        {child && child}
      </div>

      {/* Popup modal with portal */}
      <PopupModalWithTitle
        isOpen={showAccountsPopup}
        onRequestClose={handlePopupToggle.bind(null, setShowAccountsPopup, false)}
        title={<T id="selectAccount" />}
        portalClassName="accounts-popup"
      >
        <AccountPopup opened={showAccountsPopup} setOpened={setShowAccountsPopup} onlyAccSelect={onlyAccSelect} />
      </PopupModalWithTitle>
    </div>
  );
};

// TODO move to GetPro popup | screen
export const GetProlabel: FC = () => {
  return (
    <div className="px-2 py-1 text-white text-xs bg-accent-blue mt-1 rounded text-center cursor-not-allowed">
      <T id="getPro" />
    </div>
  );
};
