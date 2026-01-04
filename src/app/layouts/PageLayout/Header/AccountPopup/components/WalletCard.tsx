import React from 'react';

import { useGasToken } from 'lib/assets/hooks';
import { useAccount } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

import { AccountItem } from '../AccountItem';

type WalletCardProps = {
  name: string;
  accounts: TempleAccount[];
  handleAccountClick: (publicKeyHash: string) => void;
};

export const WalletCard = ({ name, accounts, handleAccountClick }: WalletCardProps) => {
  const { assetName: gasTokenName } = useGasToken();
  const { publicKeyHash } = useAccount();

  return (
    <section className="bg-tertiary-card pt-2 flex flex-col rounded-lg">
      <div className="flex items-center gap-2 p-2 sticky top-0 z-10 bg-tertiary-card rounded-lg">
        <p className="text-base-plus text-white font-bold">{name}</p>
        <p className="text-sm text-secondary-white">{accounts?.length ?? 0} Accounts</p>
      </div>
      <div className="flex flex-col">
        {accounts.map(account => (
          <AccountItem
            key={account.publicKeyHash}
            account={account}
            gasTokenName={gasTokenName}
            attractSelf={true}
            selected={account.publicKeyHash === publicKeyHash}
            onClick={() => handleAccountClick(account.publicKeyHash)}
          />
        ))}
      </div>
    </section>
  );
};
