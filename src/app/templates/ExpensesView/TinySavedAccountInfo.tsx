import React, { FC } from 'react';

import { Identicon } from 'app/atoms';
import CopyButton from 'app/atoms/CopyButton';
import { TempleAccount } from 'lib/temple/types';

type TinySavedAccountInfoProps = {
  account: TempleAccount;
};

export const TinySavedAccountInfo: FC<TinySavedAccountInfoProps> = ({ account }) => {
  return (
    <div className="flex gap-1 items-center">
      <Identicon className="rounded-full overflow-hidden" type="bottts" hash={account.publicKeyHash} size={16} />
      <CopyButton text={account.publicKeyHash} className="text-base-plus text-blue-200">
        {account.name}
      </CopyButton>
    </div>
  );
};
