import React, { HTMLAttributes, memo, ReactNode } from 'react';

import classNames from 'clsx';

import { HashChip } from 'app/atoms';
import AccountTypeBadge from 'app/atoms/AccountTypeBadge';
import Identicon from 'app/atoms/Identicon';
import Money from 'app/atoms/Money';
import Name from 'app/atoms/Name';
import Balance from 'app/templates/Balance';
import { t } from 'lib/i18n';
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

const AccountBanner = memo<AccountBannerProps>(
  ({ account, displayBalance = true, networkRpc, className, label, labelIndent = 'md', labelDescription }) => {
    const labelWithFallback = label ?? t('account');
    const { metadata } = useGasToken();

    return (
      <div className={classNames('flex flex-col', className)}>
        <div className="w-full flex items-center justify-between pb-4 border-b bordeer-divider">
          <div className=" flex items-center">
            <Identicon
              type="bottts"
              hash={account.publicKeyHash}
              size={32}
              className="flex-shrink-0 shadow-xs rounded-full"
            />

            <div className="flex flex-col items-start ml-2">
              <div className="flex flex-wrap items-center">
                <Name className="text-base-plus text-white">{account.name}</Name>

                <AccountTypeBadge account={account} />
              </div>

              <div className="flex items-center mt-1">
                <div className="text-xs leading-none text-gray-700">
                  <HashChip hash={account.publicKeyHash} small />
                </div>
              </div>
            </div>
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
  }
);

export default AccountBanner;
