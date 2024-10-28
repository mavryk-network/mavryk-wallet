import React, { FC, useCallback, useState } from 'react';

import classNames from 'clsx';

import { Button, Identicon, Name } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ReactComponent as AddressIcon } from 'app/icons/adress-with-setting.svg';
import { ReactComponent as ArrowDownicon } from 'app/icons/chevron-down.svg';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { T, t } from 'lib/i18n';
import { TempleAccount } from 'lib/temple/types';
import { useTippyById } from 'lib/ui/useTippy';
import { Link } from 'lib/woozie';

import AccountPopup from '.';

const tippyProps = {
  trigger: 'mouseenter',
  hideOnClick: true,
  content: t('manageAddresses'),
  animation: 'shift-away-subtle'
};

export type AccountButtonProps = {
  child?: JSX.Element;
  iconSize?: number;
  account: TempleAccount;
  onlyAccSelect?: boolean;
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
  onlyAccSelect = false,
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

  const handleMouseEnter = useTippyById('#manageAddressesBtn', tippyProps);

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
        title={<T id="selectAccount" />}
        portalClassName="accounts-popup"
        contentPosition={popup ? 'bottom' : 'center'}
        leftSidedComponent={
          <button
            id="manageAddressesBtn"
            onMouseEnter={handleMouseEnter}
            className={classNames(popup ? 'w-6' : 'w-8 flex justify-start')}
          >
            <Link to="/settings/address-book" className="w-6">
              <AddressIcon className="w-6 h-6" />
            </Link>
          </button>
        }
      >
        <AccountPopup opened={showAccountsPopup} setOpened={setShowAccountsPopup} onlyAccSelect={onlyAccSelect} />
      </PopupModalWithTitle>
    </div>
  );
};
