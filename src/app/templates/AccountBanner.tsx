import React, { HTMLAttributes, memo, ReactNode } from 'react';

import classNames from 'clsx';

import { HashChip, Money } from 'app/atoms';
import { AccountPopupButton } from 'app/layouts/PageLayout/Header/AccountPopup/AccountPopupButton';
import { useTotalBalance } from 'app/pages/Home/OtherComponents/MainBanner/use-total-balance';
import { useFiatCurrency } from 'lib/fiat-currency';
import { TempleAccount } from 'lib/temple/types';

type AccountBannerProps = HTMLAttributes<HTMLDivElement> & {
  account: TempleAccount;
  displayBalance?: boolean;
  networkRpc?: string;
  label?: ReactNode;
  labelDescription?: ReactNode;
  labelIndent?: 'sm' | 'md';
  restrictAccountSelect?: boolean;
};

const AccountBanner = memo<AccountBannerProps>(
  ({ account, displayBalance = true, restrictAccountSelect = false, networkRpc, className }) => {
    const totalBalanceInFiat = useTotalBalance();

    const {
      selectedFiatCurrency: { symbol: fiatSymbol }
    } = useFiatCurrency();

    return (
      <div className={classNames('flex flex-col', className)}>
        <div className="w-full flex items-center justify-between pb-4 border-b border-divider">
          <div className=" flex items-center">
            <AccountPopupButton
              account={account}
              iconSize={32}
              onlyAccSelect
              restrictAccountSelect={restrictAccountSelect}
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
            <div className="flex items-center flex-wrap justify-end ml-auto text-base-plus text-white">
              <span className="ml-1">{fiatSymbol}</span>
              <Money smallFractionFont={false} fiat>
                {totalBalanceInFiat}
              </Money>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default AccountBanner;
