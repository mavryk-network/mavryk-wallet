import React from 'react';

import { useGasToken } from 'lib/assets/hooks';
import { DisplayedGroup } from 'lib/temple/types';
import { navigate } from 'lib/woozie';

import { AccountItem } from '../AccountItem';
import { WalletCardDropdown } from '../WalletCardDropdown/WalletCardDropdown';

type WalletCardProps = {
  group: DisplayedGroup;
};

export const WalletCard = ({ group }: WalletCardProps) => {
  const { name, accounts, id: walletId, color, type } = group;
  const { assetName: gasTokenName } = useGasToken();

  console.log(group, 'group');

  const handleAccountClick = (publicKeyHash: string) => {
    navigate(`edit-account/${publicKeyHash}`);
  };

  return (
    <section className="bg-primary-card pt-2 flex flex-col rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 p-2 sticky top-0 z-10 bg-primary-card rounded-lg">
        <p className="text-base-plus text-white font-bold">{name}</p>

        {type === 0 && (
          <>
            <p className="text-sm text-secondary-white">{accounts?.length ?? 0} Accounts</p>
            <p className="ml-auto text-white flex items-center gap-0.5">
              <WalletCardDropdown walletId={walletId} walletName={name} />
            </p>
          </>
        )}
      </div>
      <div className="flex flex-col">
        {accounts.map((account, idx) => (
          <AccountItem
            key={account.publicKeyHash}
            account={account}
            gasTokenName={gasTokenName}
            attractSelf={true}
            onClick={() => handleAccountClick(account.publicKeyHash)}
            keyColor={idx === 0 ? color : undefined}
          />
        ))}
      </div>
    </section>
  );
};
