import React, { ComponentProps, FC } from 'react';

import classNames from 'clsx';

import { Button } from 'app/atoms/Button';
import HashShortView from 'app/atoms/HashShortView';
import Identicon from 'app/atoms/Identicon';
import Name from 'app/atoms/Name';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { T } from 'lib/i18n';
import { TempleContact } from 'lib/temple/types';
import { useScrollIntoView } from 'lib/ui/use-scroll-into-view';

import { SendFormSelectors } from './selectors';

type ContactsDropdownItemProps = ComponentProps<typeof Button> & {
  contact: TempleContact;
  active?: boolean;
};

const ContactsDropdownItem: FC<ContactsDropdownItemProps> = ({ contact, active, ...rest }) => {
  const ref = useScrollIntoView<HTMLButtonElement>(active, { behavior: 'smooth', block: 'start' });

  return (
    <Button
      ref={ref}
      type="button"
      testID={SendFormSelectors.contactItemButton}
      className={classNames(
        'w-full flex items-center',
        'px-4 py-2 text-left',
        active ? 'bg-gray-700' : 'hover:bg-gray-700 focus:bg-gray-800'
      )}
      tabIndex={-1}
      {...rest}
    >
      <Identicon
        type="bottts"
        hash={contact.address}
        size={24}
        className="flex-shrink-0 rounded-full overflow-hidden"
      />

      <div className="ml-2 flex flex-1 w-full">
        <div className="flex flex-col justify-between flex-1">
          <Name className="text-base-plus text-white text-left">{contact.name}</Name>

          <span
            className={classNames('text-sm font-light text-white')}
            {...setTestID(SendFormSelectors.contactHashValue)}
            {...setAnotherSelector('hash', contact.address)}
          >
            <div className="text-sm text-blue-200 font-normal">
              <HashShortView hash={contact.address} />
            </div>
          </span>
        </div>

        {contact.accountInWallet ? (
          <div className="flex items-center">
            <span className={'p-1 ml-1 rounded border text-xs border-accent-blue text-accent-blue'}>
              <T id="ownAccount" />
            </span>
          </div>
        ) : null}
      </div>
    </Button>
  );
};

export default ContactsDropdownItem;
