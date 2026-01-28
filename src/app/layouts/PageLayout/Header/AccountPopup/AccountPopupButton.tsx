import React, { FC, useCallback, useState } from 'react';

import classNames from 'clsx';

import { Button, Identicon, Name } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ReactComponent as ArrowDownicon } from 'app/icons/chevron-down.svg';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { TempleAccount } from 'lib/temple/types';

import AccountPopup from '.';

export type AccountButtonProps = {
  child?: JSX.Element;
  iconSize?: number;
  account: TempleAccount;
  restrictAccountSelect?: boolean;
};

export enum AccountSelectors {
  templeLogoIcon = 'Header/Temple Logo Icon',
  accountIcon = 'Header/Account Icon'
}

export const AccountPopupButton: FC<AccountButtonProps> = ({
  account,
  child,
  iconSize = 24,
  restrictAccountSelect = false
}) => {
  const { popup } = useAppEnv();
  const [showAccountsPopup, setShowAccountsPopup] = useState(false);

  const handlePopupToggle = useCallback(
    (popupFunction: (v: boolean) => void, popupValue: boolean) => {
      if (!restrictAccountSelect) {
        popupFunction(popupValue);
      }
    },
    [restrictAccountSelect]
  );

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
          {!restrictAccountSelect && <ArrowDownicon className="stroke stroke-2 stroke-white w-4 h-auto ml-1" />}
        </div>
        {child && child}
      </div>

      {/* Popup modal with portal */}
      <PopupModalWithTitle
        isOpen={showAccountsPopup}
        onRequestClose={handlePopupToggle.bind(null, setShowAccountsPopup, false)}
        title={<>My Accounts</>}
        portalClassName="accounts-popup"
        contentPosition={popup ? 'bottom' : 'center'}
      >
        <AccountPopup opened={showAccountsPopup} setOpened={setShowAccountsPopup} />
      </PopupModalWithTitle>
    </div>
  );
};
