import React, { HTMLAttributes, memo, ReactNode } from 'react';

import classNames from 'clsx';

import { HashChip } from 'app/atoms';
import Money from 'app/atoms/Money';
import { AccountPopupButton } from 'app/layouts/PageLayout/Header/AccountPopup/AccountPopupButton';
import Balance from 'app/templates/Balance';
import { useGasToken } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

type AccountBannerProps = HTMLAttributes<HTMLDivElement> & {
  account: TempleAccount;
  displayBalance?: boolean;
  networkRpc?: string;
  label?: ReactNode;
  labelDescription?: ReactNode;
  labelIndent?: 'sm' | 'md';
};

const AccountBanner = memo<AccountBannerProps>(({ account, displayBalance = true, networkRpc, className }) => {
  const { metadata } = useGasToken();

  return (
    <div className={classNames('flex flex-col', className)}>
      <div className="w-full flex items-center justify-between pb-4 border-b bordeer-divider">
        <div className=" flex items-center">
          <AccountPopupButton
            account={account}
            iconSize={32}
            child={
              <div className="flex items-center mt-1">
                <div className="text-xs leading-none text-gray-700">
                  <HashChip hash={account.publicKeyHash} small />
                </div>
              </div>
            }
          />
        </div>

        {displayBalance && (
          <>
            <Balance address={account.publicKeyHash} networkRpc={networkRpc}>
              {bal => (
                <div className="ml-2 text-base-plus flex items-baseline text-white">
                  <Money>{bal}</Money>
                  <span className="ml-1" style={{ fontSize: '0.75em' }}>
                    {metadata.symbol}
                  </span>
                </div>
              )}
            </Balance>
          </>
        )}
      </div>
    </div>
  );
});

export default AccountBanner;
