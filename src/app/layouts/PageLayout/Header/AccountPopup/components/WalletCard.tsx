import React from 'react';

import { useGasToken } from 'lib/assets/hooks';
import { TempleAccount } from 'lib/temple/types';

import { AccountItem } from '../AccountItem';

type WalletCardProps = {
  name: string;
  accounts: TempleAccount[];
};

export const WalletCard = ({ name, accounts }: WalletCardProps) => {
  const { assetName: gasTokenName } = useGasToken();

  return (
    <section className="bg-list-item-selected py-2 flex flex-col rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2">
        <p className="text-base-plus text-white">{name}</p>
        <p className="text-sm text-secondary-white">{accounts?.length ?? 0} Accounts</p>
      </div>
      <div className="flex flex-col">
        {accounts.map(account => (
          <AccountItem
            key={account.publicKeyHash}
            account={account}
            gasTokenName={gasTokenName}
            attractSelf={true}
            selected={false}
            onClick={function (): void {
              throw new Error('Function not implemented.');
            }}
          />
        ))}
      </div>
    </section>
  );
};
