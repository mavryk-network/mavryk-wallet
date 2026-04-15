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
    <span className={clsx('ml-1 rounded border text-xs border-accent-blue text-accent-blue px-1 py-0.5')}>{title}</span>
  ) : null;
});

export default AccountTypeBadge;
