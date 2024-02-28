import React, { FC, useCallback, useEffect, useMemo } from 'react';

import classNames from 'clsx';

import { Name, Identicon, HashChip } from 'app/atoms';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { TopbarRightText } from 'app/molecules/TopbarRightText';
import { TabComponentProps } from 'app/pages/Settings/Settings';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { t, T } from 'lib/i18n';
import { useAccount, useFilteredContacts } from 'lib/temple/front';
import { TempleAccount, TempleContact } from 'lib/temple/types';
import { Link, navigate } from 'lib/woozie';

import CustomSelect, { OptionRenderProps } from '../CustomSelect';
import { AddressBookSelectors } from './AddressBook.selectors';

type ContactActions = {
  remove: (address: string) => void;
};

export const AddressBook: React.FC<TabComponentProps> = ({ setToolbarRightSidedComponent }) => {
  const { allContacts: filteredContacts } = useFilteredContacts();
  const account = useAccount();

  const allContacts = useMemo(
    () =>
      filteredContacts.sort((a, b) => {
        if (a.address === account.publicKeyHash) {
          return -1;
        } else if (b.address === account.publicKeyHash) {
          return 1;
        } else {
          return 0;
        }
      }),
    [filteredContacts, account.publicKeyHash]
  );

  const isContactsEmpty = allContacts.length === 0;

  const handleAddContactClick = useCallback(() => {
    navigate('/settings/add-contact');
  }, []);

  const AddComponent = useMemo(
    () => <TopbarRightText onClick={handleAddContactClick} label={t('add')} />,
    [handleAddContactClick]
  );

  useEffect(() => {
    if (!isContactsEmpty) {
      setToolbarRightSidedComponent(AddComponent);
    }

    return () => {
      setToolbarRightSidedComponent(null);
    };
  }, [AddComponent, isContactsEmpty, setToolbarRightSidedComponent]);

  return isContactsEmpty ? (
    <section className="w-full h-full flex justify-center items-center">
      <div className="flex flex-col">
        <div className="text-base-plus text-white mb-2">
          <T id="noContacts" />
        </div>
        <div className="text-sm text-secondary-white mb-4">
          <T id="addAddresesDesc" />
        </div>
        <ButtonRounded size="small" className="self-center rounded-2xl-plus" onClick={handleAddContactClick} fill>
          <T id="addAddress" />
        </ButtonRounded>
      </div>
    </section>
  ) : (
    <div className="w-full max-w-sm mx-auto -mt-3">
      <CustomSelect
        className="mb-6 p-0"
        getItemId={getContactKey}
        items={allContacts}
        OptionIcon={ContactIcon}
        OptionContent={item => <ContactContent {...item} account={account} />}
        light
        hoverable={false}
        padding={0}
        itemWithBorder
      />
    </div>
  );
};

const ContactIcon: React.FC<OptionRenderProps<TempleContact, string, ContactActions>> = ({ item }) => (
  <Identicon type="bottts" hash={item.address} size={32} className="flex-shrink-0 shadow-xs rounded-full" />
);

const ContactContent: React.FC<
  OptionRenderProps<TempleContact, string, ContactActions> & { account: TempleAccount }
> = ({ item, account }) => {
  return (
    <div
      className="flex flex-1 w-full py-3"
      {...setTestID(AddressBookSelectors.contactItem)}
      {...setAnotherSelector('hash', item.address)}
    >
      <div className="flex flex-col justify-between flex-1">
        <div className="flex items-center">
          <Name className="mb-px text-base-plus text-white text-left">{item.name}</Name>
          <AddressBookBadge own={item.accountInWallet} isCurrent={account.publicKeyHash === item.address} />
        </div>

        <div className="text-sm mt-1">
          <HashChip hash={item.address} small />
        </div>
      </div>

      <Link to={`/edit-account/${item.address}`} className="flex items-center">
        <ButtonRounded size="xs" fill={false}>
          <T id="edit" />
        </ButtonRounded>
      </Link>
    </div>
  );
};

type AddressBookBadgeProps = {
  own: boolean | undefined;
  isCurrent: boolean;
};

const AddressBookBadge: FC<AddressBookBadgeProps> = ({ own, isCurrent }) => {
  if (!own) return null;

  return (
    <div className="flex items-center">
      <span
        className={classNames('p-1 ml-1 rounded border text-xs border-accent-blue text-accent-blue')}
        {...setTestID(AddressBookSelectors.contactOwnLabelText)}
      >
        {isCurrent ? <T id="current" /> : <T id="ownAccount" />}
      </span>
    </div>
  );
};

function getContactKey(contract: TempleContact) {
  return contract.address;
}
