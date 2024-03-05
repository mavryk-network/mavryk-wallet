import React, { FC, memo, useMemo, useState } from 'react';

import clsx from 'clsx';

import { HashShortView, Identicon, Money, Name } from 'app/atoms';
import AccountTypeBadge from 'app/atoms/AccountTypeBadge';
import { FiatBalance } from 'app/pages/Home/OtherComponents/Tokens/components/Balance';
import Balance from 'app/templates/Balance';
import CustomSelect, { OptionRenderProps } from 'app/templates/CustomSelect';
import { DropdownSelect, SelectOptionsPropsBase } from 'app/templates/DropdownSelect/DropdownSelect';
import { t } from 'lib/i18n';
import { useGasToken, useRelevantAccounts } from 'lib/temple/front';
import { TempleAccount, TempleDAppPayload } from 'lib/temple/types';

type AccountDropdownProps = {
  payload: TempleDAppPayload;
  accountPkhToConnect: string;
  setAccountPkhToConnect: (item: string) => void;
};

export const AccountDropdown: FC<AccountDropdownProps> = ({ payload, accountPkhToConnect, setAccountPkhToConnect }) => {
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
      DropdownFaceContent={<AccountOptionContent item={selectedAcc} selected={false} />}
      dropdownButtonClassName="p-4 bg-primary-card h-66px"
      fontContentWrapperClassname="border border-transparent rounded-xl"
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

const AccountOptionContent = memo<{ item: TempleAccount; selected: boolean }>(({ item: acc, selected }) => {
  return (
    <div
      className={clsx(
        'flex items-center justify-between w-full',
        'text-white overflow-hidden p-4',
        'transition duration-200 ease-in-out',
        'hover:bg-primary-card-hover',
        selected ? 'bg-primary-card-hover' : 'bg-primary-card'
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
              <FiatBalance assetSlug={'tez'} value={bal} showEqualSymbol={false} className="text-base-plus" />
            </span>
          )}
        </Balance>
      </div>
    </div>
  );
});

const renderOptionContent = (item: TempleAccount, selected: boolean) => (
  <AccountOptionContent item={item} selected={selected} />
);

const getPkh = (option: TempleAccount) => option.publicKeyHash;
