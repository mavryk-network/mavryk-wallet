import React, { FC, useCallback, useEffect, useMemo } from 'react';

import classNames from 'clsx';

import { Name, Identicon, HashChip } from 'app/atoms';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { TopbarRightText } from 'app/molecules/TopbarRightText';
import { TabComponentProps } from 'app/pages/Settings/Settings';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { t, T } from 'lib/i18n';
import { useAccount, useFilteredContacts } from 'lib/temple/front';
import { TempleAccount, TempleContact } from 'lib/temple/types';
import { Link, navigate } from 'lib/woozie';

import CustomSelect, { OptionRenderProps } from '../CustomSelect';

import styles from './addressBook.module.css';
import { AddressBookSelectors } from './AddressBook.selectors';

type ContactActions = {
  remove: (address: string) => void;
};

export const AddressBook: React.FC<TabComponentProps> = ({ setToolbarRightSidedComponent }) => {
  const { allContacts: filteredContacts } = useFilteredContacts();
  const account = useAccount();
  const { popup } = useAppEnv();

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

  // There is always one account (the current one)
  const isContactsEmpty = allContacts.length === 1;

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

  return (
    <div className="flex flex-col h-full">
      <div className={classNames('w-full mx-auto -mt-3', popup ? 'max-w-sm' : 'max-w-screen-xxs')}>
        <CustomSelect
          className={classNames('p-0', isContactsEmpty ? 'mb-0' : 'mb-6')}
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
      {isContactsEmpty && (
        <section className="w-full flex-grow flex justify-center items-center">
          <div className="flex flex-col items-center text-center">
            <div className="text-base-plus text-white mb-2">
              <T id="noContacts" />
            </div>
            <div className="text-sm text-secondary-white mb-4 text-center">
              <T id="addAddresesDesc" />
            </div>
            <ButtonRounded
              size="small"
              className={classNames('self-center rounded-2xl-plus', styles.contactButton)}
              onClick={handleAddContactClick}
              fill
            >
              <T id="addContact" />
            </ButtonRounded>
          </div>
        </section>
      )}
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
        style={{ padding: '2px 4px' }}
        className={classNames('ml-1 rounded border text-xs border-accent-blue text-accent-blue')}
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
