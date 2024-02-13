import React, { useMemo } from 'react';

import classNames from 'clsx';

import { Name, Button, HashShortView, Money, Identicon } from 'app/atoms';
import AccountTypeBadge from 'app/atoms/AccountTypeBadge';
import { ReactComponent as EditAccIcon } from 'app/icons/edit-title.svg';
import Balance from 'app/templates/Balance';
import { TempleAccount } from 'lib/temple/types';
import { useScrollIntoViewOnMount } from 'lib/ui/use-scroll-into-view';
import { Link } from 'lib/woozie';

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
      // onClick={onClick}
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
        <Name className="text-base">{name}</Name>
        <Link to={`/edit-account/${publicKeyHash}/${name}`}>
          <EditAccIcon className="stroke w-5 h-6 fill-white ml-1" />
        </Link>

        <div
          className="text-xs text-blue-200 mt-1"
          {...setTestID(AccountDropdownSelectors.accountAddressValue)}
          {...setAnotherSelector('hash', publicKeyHash)}
        >
          <HashShortView hash={publicKeyHash} />
        </div>
      </div>
      <div className="flex flex-col flex-wrap items-end justify-end ml-auto">
        <Balance address={publicKeyHash}>
          {bal => (
            <span className="text-base leading-tight flex items-baseline">
              <Money smallFractionFont={false} tooltip={false}>
                {bal}
              </Money>

              <span className="ml-1">{gasTokenName.toUpperCase()}</span>
            </span>
          )}
        </Balance>
        <div className="mt-1">
          <AccountTypeBadge account={account} darkTheme />
        </div>
      </div>
    </Button>
  );
};
