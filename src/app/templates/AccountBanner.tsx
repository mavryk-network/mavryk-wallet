import React, { HTMLAttributes, memo, ReactNode } from 'react';

import classNames from 'clsx';

import { HashChip, Money } from 'app/atoms';
import { AccountPopupButton } from 'app/layouts/PageLayout/Header/AccountPopup/AccountPopupButton';
import { useTotalBalance } from 'app/pages/Home/OtherComponents/MainBanner/use-total-balance';
import { useFiatCurrency } from 'lib/fiat-currency';
import { MAVEN_METADATA } from 'lib/metadata';
import { TempleAccount } from 'lib/temple/types';

import Balance from './Balance';

type AccountBannerProps = HTMLAttributes<HTMLDivElement> & {
  account: TempleAccount;
  displayBalance?: boolean;
  networkRpc?: string;
  label?: ReactNode;
  labelDescription?: ReactNode;
  labelIndent?: 'sm' | 'md';
  restrictAccountSelect?: boolean;
  showDivider?: boolean;
  showMVRK?: boolean;
};

const AccountBanner = memo<AccountBannerProps>(
  ({
    account,
    displayBalance = true,
    restrictAccountSelect = false,
    showDivider = true,
    showMVRK = false,
    className
  }) => {
    const totalBalanceInFiat = useTotalBalance();
    // const { value: gasBalance } = useBalance(MAV_TOKEN_SLUG, account.publicKeyHash);

    const {
      selectedFiatCurrency: { symbol: fiatSymbol }
    } = useFiatCurrency();

    return (
      <div className={classNames('flex flex-col', className)}>
        <div
          className={classNames(
            'w-full flex items-center justify-between',
            showDivider && 'pb-4 border-b border-divider'
          )}
        >
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
            <div className="flex flex-col gap-1">
              <div className="flex items-center flex-wrap justify-end ml-auto text-base-plus text-white">
                <span className="ml-1">{fiatSymbol}</span>
                <Money smallFractionFont={false} fiat tooltip={false}>
                  {totalBalanceInFiat}
                </Money>
              </div>
              {showMVRK && (
                <div className="text-white text-sm flex items-center">
                  <Balance address={account.publicKeyHash}>
                    {bal => (
                      <div className={classNames('text-sm leading-none', 'text-secondary-white')}>
                        <Money smallFractionFont={false}>{bal}</Money> <span>{MAVEN_METADATA.symbol}</span>
                      </div>
                    )}
                  </Balance>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default AccountBanner;
