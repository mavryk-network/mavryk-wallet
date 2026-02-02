import React, { FC } from 'react';

import clsx from 'clsx';

import { setTestID } from 'lib/analytics';
import { T } from 'lib/i18n';

import { AddressBookSelectors } from '../Contacts.selectors';

export type ContactsBadgeProps = {
  own: boolean | undefined;
  isCurrent: boolean;
};

export const ContactsBadge: FC<ContactsBadgeProps> = ({ own, isCurrent }) => {
  if (!own) return null;

  return (
    <div className="flex items-center">
      <span
        style={{ padding: '2px 4px' }}
        className={clsx('ml-1 rounded border text-xs border-accent-blue text-accent-blue')}
        {...setTestID(AddressBookSelectors.contactOwnLabelText)}
      >
        {isCurrent ? <T id="current" /> : <T id="ownAccount" />}
      </span>
    </div>
  );
};
