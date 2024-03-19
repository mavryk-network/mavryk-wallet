import React, { FC } from 'react';

import { Identicon } from 'app/atoms';
import { IdeniconType } from 'app/atoms/Identicon';
import AddressChip from 'app/templates/AddressChip';

type AvatarBlockProps = {
  hash: string;
  name: string;
  size?: number;
  type?: IdeniconType;
};

export const AvatarBlock: FC<AvatarBlockProps> = ({ name, hash, size = 32, type = 'bottts' }) => {
  return (
    <div className="flex items-center gap-x-2 w-full">
      <Identicon
        type={type}
        hash={hash}
        size={size}
        className="flex-shrink-0 shadow-xs-white rounded-full overflow-hidden"
      />

      <div className="flex flex-col gap-y-2px">
        <div className="text-white text-base-plus">{name}</div>
        <AddressChip pkh={hash} />
      </div>
    </div>
  );
};
