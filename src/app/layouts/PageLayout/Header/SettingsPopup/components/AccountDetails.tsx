import React, { FC, useMemo } from 'react';

import clsx from 'clsx';
import { QRCode } from 'react-qr-svg';

import { HashShortView, Identicon, Name } from 'app/atoms';
import CopyButton from 'app/atoms/CopyButton';
import { useAppEnv } from 'app/env';
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
  const { popup } = useAppEnv();

  return (
    <PopupModalWithTitle
      isOpen={showAccountsPopup}
      onRequestClose={toggleAccountPopup}
      contentPosition={!popup ? 'center' : 'bottom'}
      title={
        <div className="flex items-center gap-2">
          <Identicon hash={account.publicKeyHash} type="bottts" size={24} className="rounded-full overflow-hidden" />
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
  const { fullPage } = useAppEnv();

  const memoizedStyle = useMemo(() => (fullPage ? { maxWidth: 'auto' } : { maxWidth: 271 }), [fullPage]);
  return (
    <div className={clsx('px-4 text-base-plus text-white flex flex-col items-center', !fullPage && 'pt-2')}>
      <div className="p-6 bg-white rounded-2xl self-center">
        <QRCode value={account.publicKeyHash} bgColor="#f4f4f4" fgColor="#000000" level="L" style={{ width: 152 }} />
      </div>

      <div
        className={clsx(
          'rounded-2xl-plus bg-gray-710 relative w-full p-4',
          fullPage ? 'mt-8 flex items-center justify-between' : 'mt-6'
        )}
      >
        <CopyButton type="button" text={account.publicKeyHash} className="flex w-full justify-between items-center">
          <div className="break-all text-left text-base-plus" style={memoizedStyle}>
            <HashShortView hash={account.publicKeyHash} trim={false} />
          </div>

          <div
            className={clsx(
              'bg-transparent flex items-center',
              !fullPage ? 'w-11 absolute top-4 right-4 justify-end' : 'justify-start h-6 w0auto'
            )}
          >
            <CopyIcon className="w-6 h-6 text-blue-200 fill-current" />
          </div>
        </CopyButton>
      </div>
    </div>
  );
};
