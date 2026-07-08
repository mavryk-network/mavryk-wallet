import React, { FC } from 'react';

import { Identicon } from 'app/atoms';
import { useNetwork } from 'lib/temple/front';
import { DEFAULT_VALIDATOR_LOGO } from 'lib/temple/front/baking/const';
import { getPredefinedBaker } from 'lib/temple/front/baking/utils';
import { TempleContact } from 'lib/temple/types';
import { merge } from 'lib/utils/merge';

type ContactAvatarProps = {
  contact: TempleContact;
  size?: number;
  className?: string;
};

export const ContactAvatar: FC<ContactAvatarProps> = ({ contact, size = 32, className }) => {
  const network = useNetwork();
  const validatorLogo =
    network.type === 'main' && contact.type === 'validator'
      ? getPredefinedBaker(contact.address)?.logo ?? DEFAULT_VALIDATOR_LOGO
      : null;
  const iconClassName = merge(
    'inline-flex flex-shrink-0 items-center justify-center rounded-full overflow-hidden bg-transparent',
    className
  );

  if (!validatorLogo) {
    return <Identicon type="bottts" hash={contact.address} size={size} className={iconClassName} />;
  }

  if (typeof validatorLogo === 'string') {
    return (
      <img
        src={validatorLogo}
        alt=""
        width={size}
        height={size}
        aria-hidden="true"
        className={merge(iconClassName, 'object-cover')}
        style={{ width: size, height: size }}
      />
    );
  }

  const ValidatorLogo = validatorLogo;

  return (
    <span aria-hidden="true" className={iconClassName} style={{ width: size, height: size }}>
      <ValidatorLogo className="w-full h-full" />
    </span>
  );
};
