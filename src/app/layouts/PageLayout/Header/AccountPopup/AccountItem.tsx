import React, { useCallback, useMemo } from 'react';

import classNames from 'clsx';

import { Name, Button, HashShortView, Money, Identicon } from 'app/atoms';
import AccountTypeBadge from 'app/atoms/AccountTypeBadge';
import { FiatBalance } from 'app/pages/Home/OtherComponents/Tokens/components/Balance';
import Balance from 'app/templates/Balance';
import { t } from 'lib/i18n';
import { TempleAccount } from 'lib/temple/types';
import { useScrollIntoViewOnMount } from 'lib/ui/use-scroll-into-view';
import useTippy, { UseTippyOptions } from 'lib/ui/useTippy';

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
      <div className="flex flex-col flex-wrap items-end justify-end ml-auto">
        <Balance address={publicKeyHash}>
          {bal => (
            <span className="text-base leading-tight flex items-baseline">
              <FiatBalance assetSlug={'tez'} value={bal} showEqualSymbol={false} className="text-base-plus" />
            </span>
          )}
        </Balance>
      </div>
    </Button>
  );
};
