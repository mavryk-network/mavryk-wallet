import React, { HTMLAttributes, memo, ReactNode } from 'react';

import classNames from 'clsx';

import { HashChip } from 'app/atoms';
import { AccountPopupButton } from 'app/layouts/PageLayout/Header/AccountPopup/AccountPopupButton';
import { FiatBalance } from 'app/pages/Home/OtherComponents/Tokens/components/Balance';
import Balance from 'app/templates/Balance';
import { TempleAccount } from 'lib/temple/types';

type AccountBannerProps = HTMLAttributes<HTMLDivElement> & {
  account: TempleAccount;
  displayBalance?: boolean;
  networkRpc?: string;
  label?: ReactNode;
  labelDescription?: ReactNode;
  labelIndent?: 'sm' | 'md';
  showDropDownIcon?: boolean;
};

const AccountBanner = memo<AccountBannerProps>(
  ({ account, displayBalance = true, showDropDownIcon = true, networkRpc, className }) => {
    return (
      <div className={classNames('flex flex-col', className)}>
        <div className="w-full flex items-center justify-between pb-4 border-b bordeer-divider">
          <div className=" flex items-center">
            <AccountPopupButton
              account={account}
              iconSize={32}
              onlyAccSelect
              showDropDownIcon={showDropDownIcon}
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
                    <FiatBalance assetSlug={'tez'} value={bal} showEqualSymbol={false} className="text-base-plus" />
                  </div>
                )}
              </Balance>
            </>
          )}
        </div>
      </div>
    );
  }
);

export default AccountBanner;
