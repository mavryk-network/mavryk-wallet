import React, { useMemo } from 'react';

import classNames from 'clsx';

import { Name, Button, HashShortView, Identicon } from 'app/atoms';
import AccountTypeBadge from 'app/atoms/AccountTypeBadge';
import { ReactComponent as KeyIcon } from 'app/icons/acc-key.svg';
import { ReactComponent as ChevronRightIcon } from 'app/icons/chevron-right.svg';
import { TempleAccount } from 'lib/temple/types';

interface AccountItemProps {
  account: TempleAccount;
  gasTokenName: string;
  attractSelf: boolean;
  onClick: () => void;
  keyColor?: string;
}

export const AccountItem: React.FC<AccountItemProps> = ({ account, onClick, keyColor }) => {
  const { name, publicKeyHash } = account;

  const classNameMemo = useMemo(
    () =>
      classNames(
        'block w-full px-2 py-3 flex items-center',
        'text-white overflow-hidden',
        'transition ease-in-out duration-200',
        'hover:bg-list-item-selected'
      ),
    []
  );

  return (
    <Button className={classNameMemo} onClick={onClick}>
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
          {keyColor && <KeyIcon style={{ fill: keyColor }} />}
        </div>

        <div className="text-xs text-blue-200 mt-1">
          <HashShortView hash={publicKeyHash} />
        </div>
      </div>

      <ChevronRightIcon className="w-4 h-4 fill-white ml-auto" />
    </Button>
  );
};
