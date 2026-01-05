import React from 'react';

import { useGasToken } from 'lib/assets/hooks';
import { useAllAccounts } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

import { AccountItem } from '../AccountItem';
import { WalletCardDropdown } from '../WalletCardDropdown/WalletCardDropdown';

type WalletCardProps = {
  name: string;
  accounts: TempleAccount[];
  handleAccountClick: (publicKeyHash: string) => void;
};

export const WalletCard = ({ name, accounts, handleAccountClick }: WalletCardProps) => {
  const { assetName: gasTokenName } = useGasToken();
  const allAccounts = useAllAccounts();

  return (
    <section className="bg-primary-card pt-2 flex flex-col rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 sticky top-0 z-10 bg-primary-card rounded-lg">
        <p className="text-base-plus text-white font-bold">{name}</p>
        <p className="text-sm text-secondary-white">{accounts?.length ?? 0} Accounts</p>
        <p className="ml-auto text-white flex items-center gap-0.5">
          <WalletCardDropdown />
        </p>
      </div>
      <div className="flex flex-col">
        {accounts.map(account => (
          <AccountItem
            key={account.publicKeyHash}
            account={account}
            gasTokenName={gasTokenName}
            attractSelf={true}
            onClick={() => handleAccountClick(account.publicKeyHash)}
            isMainAcc={account.publicKeyHash === allAccounts[0]?.publicKeyHash}
          />
        ))}
      </div>
    </section>
  );
};
