import React, { FC, useMemo } from 'react';

import { QRCode } from 'react-qr-svg';

import { HashChip, Identicon, Name } from 'app/atoms';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { useAccount } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

type AccountDetailsPopupProps = {
  showAccountsPopup: boolean;
  toggleAccountPopup: () => void;
};

export const AccountDetailsPopup: FC<AccountDetailsPopupProps> = ({ showAccountsPopup, toggleAccountPopup }) => {
  const account = useAccount();

  return (
    <PopupModalWithTitle
      isOpen={showAccountsPopup}
      onRequestClose={toggleAccountPopup}
      title={
        <div className="flex items-center gap-2">
          <Identicon hash={account.name} type="bottts" size={24} className="rounded-full overflow-hidden" />
          <Name className="text-base-plus text-white">{account.name}</Name>
        </div>
      }
      portalClassName="account-details"
    >
      <AccountDetails account={account} />
    </PopupModalWithTitle>
  );
};

type AccountDetailsProps = {
  account: TempleAccount;
};

export const AccountDetails: FC<AccountDetailsProps> = ({ account }) => {
  const hashChipProps = useMemo(
    () =>
      account.publicKeyHash.length > 35
        ? {
            firstCharsCount: 15,
            lastCharsCount: 17
          }
        : { trim: false },
    [account.publicKeyHash]
  );

  return (
    <div className="px-4 pt-2 text-base-plus text-white flex flex-col items-center">
      <div className="p-6 bg-white rounded-2xl self-center">
        <QRCode value={account.publicKeyHash} bgColor="#f4f4f4" fgColor="#000000" level="L" style={{ width: 152 }} />
      </div>
      <div className="mt-6 bg-gray-710 rounded-xl px-4 py-2 w-full self-stretch flex items-center justify-center">
        <HashChip hash={account.publicKeyHash} small={false} {...hashChipProps} />
      </div>
    </div>
  );
};
