import React, { useMemo } from 'react';

import classNames from 'clsx';

import { Name, Button, HashShortView, Identicon, Money } from 'app/atoms';
import AccountTypeBadge from 'app/atoms/AccountTypeBadge';
import { useOtherAccountTotalBalance } from 'app/pages/Home/OtherComponents/MainBanner/use-total-balance';
import { useFiatCurrency } from 'lib/fiat-currency';
import { TempleAccount } from 'lib/temple/types';
import { useScrollIntoViewOnMount } from 'lib/ui/use-scroll-into-view';

import { setAnotherSelector, setTestID } from '../../../../../lib/analytics';
import { AccountDropdownSelectors } from '../selectors';

interface AccountItemProps {
  account: TempleAccount;
  selected: boolean;
  gasTokenName: string;
  attractSelf: boolean;
  onClick: () => void;
}

export const AccountItem: React.FC<AccountItemProps> = ({ account, selected, gasTokenName, attractSelf, onClick }) => {
  const { name, publicKeyHash, type } = account;
  const totalBalanceInDollar = useOtherAccountTotalBalance(publicKeyHash);

  const {
    selectedFiatCurrency: { symbol: fiatSymbol }
  } = useFiatCurrency();

  const elemRef = useScrollIntoViewOnMount<HTMLButtonElement>(selected && attractSelf);

  const classNameMemo = useMemo(
    () =>
      classNames(
        'block w-full px-4 py-3 flex items-center',
        'text-white overflow-hidden',
        'transition ease-in-out duration-200',
        selected ? 'bg-list-item-selected' : 'hover:bg-primary-card-hover'
      ),
    [selected]
  );

  return (
    <Button
      ref={elemRef}
      className={classNameMemo}
      onClick={onClick}
      testID={AccountDropdownSelectors.accountItemButton}
      testIDProperties={{ accountTypeEnum: type }}
    >
      <Identicon
        type="bottts"
        hash={publicKeyHash}
        size={24}
        className="flex-shrink-0 shadow-xs-white rounded-full overflow-hidden"
      />

      <div style={{ marginLeft: '12px' }} className="flex flex-col items-start">
        <div className="flex items-center gap-1">
          <Name className="text-base">{name}</Name>
          <AccountTypeBadge account={account} />
        </div>

        <div
          className="text-xs text-blue-200 mt-1"
          {...setTestID(AccountDropdownSelectors.accountAddressValue)}
          {...setAnotherSelector('hash', publicKeyHash)}
        >
          <HashShortView hash={publicKeyHash} />
        </div>
      </div>
      <div className="flex items-center flex-wrap justify-end ml-auto text-base-plus">
        <span className="ml-1">{fiatSymbol}</span>
        <Money smallFractionFont={false} fiat>
          {totalBalanceInDollar}
        </Money>
      </div>
    </Button>
  );
};
