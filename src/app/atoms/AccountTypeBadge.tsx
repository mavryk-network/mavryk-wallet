import React, { memo } from 'react';

import clsx from 'clsx';

import { getAccountBadgeTitle } from 'app/defaults';
import { TempleAccount } from 'lib/temple/types';

type AccountTypeBadgeProps = {
  account: Pick<TempleAccount, 'type'>;
};

const AccountTypeBadge = memo<AccountTypeBadgeProps>(({ account }) => {
  const title = getAccountBadgeTitle(account);

  return title ? (
    <span
      className={clsx('p-1 ml-1 rounded border text-xs border-accent-blue text-accent-blue')}
      style={{ fontSize: '0.6rem' }}
    >
      {title.toUpperCase()}
    </span>
  ) : null;
});

export default AccountTypeBadge;
