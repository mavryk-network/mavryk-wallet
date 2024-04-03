import React, { FC, memo, useMemo } from 'react';

import clsx from 'clsx';

import { HashShortView, Identicon, Name } from 'app/atoms';
import AccountTypeBadge from 'app/atoms/AccountTypeBadge';
import { FiatBalance } from 'app/pages/Home/OtherComponents/Tokens/components/Balance';
import Balance from 'app/templates/Balance';
import { DropdownSelect, SelectOptionsPropsBase } from 'app/templates/DropdownSelect/DropdownSelect';
import { MAV_TOKEN_SLUG } from 'lib/assets/utils';
import { useRelevantAccounts } from 'lib/temple/front';
import { TempleAccount } from 'lib/temple/types';

type AccountDropdownProps = {
  accountPkhToConnect: string;
  setAccountPkhToConnect: (item: string) => void;
};

export const AccountDropdown: FC<AccountDropdownProps> = ({ accountPkhToConnect, setAccountPkhToConnect }) => {
  const allAccounts = useRelevantAccounts(false);

  const selectedAcc = useMemo(
    () => allAccounts.find(acc => acc.publicKeyHash === accountPkhToConnect) ?? allAccounts[0],
    [accountPkhToConnect, allAccounts]
  );

  const handleChange = (hash: string) => {
    setAccountPkhToConnect(hash);
  };

  return (
    <DropdownSelect
      DropdownFaceContent={<AccountOptionContent item={selectedAcc} selected={false} isFaceContent />}
      dropdownButtonClassName="py-4 pr-4 bg-primary-card h-66px bg-primary-bg"
      fontContentWrapperClassname="border border-divider rounded-xl"
      dropdownWrapperClassName="border-none rounded-2xl-plus max-h-60"
      optionsListClassName="bg-primary-card"
      optionsProps={
        {
          options: allAccounts,
          noItemsText: 'No items found',
          getKey: acc => getPkh(acc),
          onOptionChange: acc => handleChange(acc.publicKeyHash),
          renderOptionContent: acc => renderOptionContent(acc, acc.publicKeyHash === selectedAcc.publicKeyHash)
        } as SelectOptionsPropsBase<TempleAccount>
      }
    />
  );
};

const AccountOptionContent = memo<{ item: TempleAccount; selected: boolean; isFaceContent?: boolean }>(
  ({ item: acc, selected, isFaceContent = false }) => {
    return (
      <div
        className={clsx(
          'flex items-center justify-between w-full',
          'text-white overflow-hidden p-4',
          'transition duration-200 ease-in-out',
          !isFaceContent && 'hover:bg-primary-card-hover',
          selected
            ? isFaceContent
              ? 'bg-primary-bg'
              : 'bg-primary-card-hover'
            : isFaceContent
            ? 'bg-primary-bg'
            : 'bg-primary-card'
        )}
      >
        <Identicon
          type="bottts"
          hash={acc.publicKeyHash}
          size={32}
          className="flex-shrink-0 shadow-xs-white rounded-full overflow-hidden"
        />

        <div style={{ marginLeft: '12px' }} className="flex flex-col items-start">
          <div className="flex items-center gap-1">
            <Name className="text-base">{acc.name}</Name>
            <AccountTypeBadge account={acc} />
          </div>

          <div className="text-sm text-blue-200 mt-1">
            <HashShortView hash={acc.publicKeyHash} />
          </div>
        </div>
        <div className="flex flex-col flex-wrap items-end justify-end ml-auto">
          <Balance address={acc.publicKeyHash}>
            {bal => (
              <span className="text-base leading-tight flex items-baseline">
                <FiatBalance
                  assetSlug={MAV_TOKEN_SLUG}
                  value={bal}
                  showEqualSymbol={false}
                  className="text-base-plus"
                />
              </span>
            )}
          </Balance>
        </div>
      </div>
    );
  }
);

const renderOptionContent = (item: TempleAccount, selected: boolean) => (
  <AccountOptionContent item={item} selected={selected} />
);

const getPkh = (option: TempleAccount) => option.publicKeyHash;
