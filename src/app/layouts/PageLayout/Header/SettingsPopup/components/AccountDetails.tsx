import React, { FC } from 'react';

import { QRCode } from 'react-qr-svg';

import { HashShortView, Identicon, Name } from 'app/atoms';
import CopyButton from 'app/atoms/CopyButton';
import { ReactComponent as CopyIcon } from 'app/icons/copy.svg';
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
  return (
    <div className="px-4 pt-2 text-base-plus text-white flex flex-col items-center">
      <div className="p-6 bg-white rounded-2xl self-center">
        <QRCode value={account.publicKeyHash} bgColor="#f4f4f4" fgColor="#000000" level="L" style={{ width: 152 }} />
      </div>

      <div className="rounded-2xl-plus bg-gray-710 relative mt-6 w-full p-4">
        <CopyButton type="button" text={account.publicKeyHash}>
          <div className="w-11 absolute top-4 right-4 bg-transparent flex justify-end items-center">
            <CopyIcon className="w-6 h-6 text-blue-200 fill-current" />
          </div>
          <div className="break-all text-left text-base-plus" style={{ maxWidth: 271 }}>
            <HashShortView hash={account.publicKeyHash} trim={false} />
          </div>
        </CopyButton>
      </div>
    </div>
  );
};
