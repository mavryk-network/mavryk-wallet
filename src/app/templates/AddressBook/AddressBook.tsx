import React, { FC, useCallback, useEffect, useMemo } from 'react';

import clsx from 'clsx';

import { Name, Identicon, HashChip } from 'app/atoms';
import { FileExportWrapper } from 'app/compound/FileTransfer';
import { useAppEnv } from 'app/env';
import { ReactComponent as ChevronRightIcon } from 'app/icons/chevron-right.svg';
import { ReactComponent as PlusIcon } from 'app/icons/plus.svg';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { TopbarRightText } from 'app/molecules/TopbarRightText';
import { TabComponentProps } from 'app/pages/Settings/Settings';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { t, T } from 'lib/i18n';
import { useAccount, useFilteredContacts } from 'lib/temple/front';
import { TempleAccount, TempleContact } from 'lib/temple/types';
import { Link, navigate } from 'lib/woozie';

import CustomSelect, { OptionRenderProps } from '../CustomSelect';
import { PopupModalWithTitle } from '../PopupModalWithTitle';
import { usePopupState } from '../PopupModalWithTitle/hooks/usePopupState';

import styles from './addressBook.module.css';
import { AddressBookSelectors } from './AddressBook.selectors';
import { ContactExportPopup } from './popups/ContactExportPopup';

type ContactActions = {
  remove: (address: string) => void;
};

export const AddressBook: React.FC<TabComponentProps> = ({ setToolbarRightSidedComponent }) => {
  const { outsideWalletContacts: filteredContacts } = useFilteredContacts();
  const account = useAccount();
  const { popup } = useAppEnv();

  const { open, opened, close } = usePopupState();

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
  const isContactsEmpty = allContacts.length === 0;

  const handleAddContactClick = useCallback(() => {
    navigate('/settings/add-contact');
  }, []);

  const handleImportContactClick = useCallback(() => {
    navigate('/settings/import-contacts');
  }, []);

  const AddComponent = useMemo(
    () => (
      <TopbarRightText
        onClick={handleAddContactClick}
        label={
          <div className="rounded-lg bg-gray-910 h-7 w-7 flex items-center justify-center">
            <PlusIcon className="w-6 h-6 stroke-2" />
          </div>
        }
      />
    ),
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

  const contacts = Array.from({ length: 20 }, (_, i) => ({
    ...allContacts[0],
    name: `${allContacts[0].name}_${i + 1}`
  }));

  return (
    <section className="flex flex-col h-full flex-1 relative">
      <div
        style={{ maxHeight: !popup ? '70vh' : 'auto' }}
        className="flex flex-col flex-1 overflow-y-auto no-scrollbarD"
      >
        {!isContactsEmpty && (
          <div className={clsx('w-full mx-auto -mt-3', popup ? 'max-w-sm' : 'max-w-screen-xxs')}>
            <CustomSelect
              className={clsx('p-0', isContactsEmpty ? 'mb-0' : 'mb-6')}
              getItemId={getContactKey}
              items={contacts}
              // items={allContacts}
              OptionIcon={ContactIcon}
              OptionContent={item => <ContactContent {...item} account={account} />}
              light
              hoverable={false}
              padding={0}
              itemWithBorder
            />
          </div>
        )}

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
                className={clsx('self-center rounded-2xl-plus', styles.contactButton)}
                onClick={handleAddContactClick}
                fill
              >
                <T id="addContact" />
              </ButtonRounded>
            </div>
          </section>
        )}
      </div>

      <div
        className={clsx('absolute bottom-0 w-full grid grid-cols-2 gap-3 bg-gray-920 z-10', popup ? 'py-6' : 'pt-6')}
      >
        <FileExportWrapper data={contacts} suggestedFileName={'contacts'} onClick={open}>
          <ButtonRounded size="big" btnType="primary" fill={false} disabled={isContactsEmpty}>
            <T id="export" />
          </ButtonRounded>
        </FileExportWrapper>
        <ButtonRounded size="big" btnType="primary" fill onClick={handleImportContactClick}>
          <T id="import" />
        </ButtonRounded>
      </div>

      <PopupModalWithTitle
        isOpen={opened}
        onRequestClose={close}
        title={<T id="chooseFileType" />}
        portalClassName="contacts-export-popup"
        contentPosition={popup ? 'bottom' : 'center'}
      >
        <ContactExportPopup close={close} />
      </PopupModalWithTitle>
    </section>
  );
};

const ContactIcon: React.FC<OptionRenderProps<TempleContact, string, ContactActions>> = ({ item }) => (
  <Identicon type="bottts" hash={item.address} size={32} className="flex-shrink-0 shadow-xs rounded-full" />
);

const ContactContent: React.FC<
  OptionRenderProps<TempleContact, string, ContactActions> & { account: TempleAccount }
> = ({ item, account }) => {
  return (
    <Link to={`/edit-account/${item.address}`} className="flex flex-1 w-full py-3">
      <div
        className="flex flex-1 w-full"
        {...setTestID(AddressBookSelectors.contactItem)}
        {...setAnotherSelector('hash', item.address)}
      >
        <div className="flex flex-col justify-between flex-1">
          <div className="flex items-center">
            <Name className="mb-px text-base-plus text-white text-left">{item.name}</Name>
            <AddressBookBadge own={item.accountInWallet} isCurrent={account.publicKeyHash === item.address} />
          </div>

          <div className="text-sm mt-1 relative z-10">
            <HashChip hash={item.address} small showIcon={false} />
          </div>
        </div>
      </div>
      <div className="ml-auto self-center">
        <ChevronRightIcon className="w-4 h-4 fill-white" />
      </div>
    </Link>
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
        className={clsx('ml-1 rounded border text-xs border-accent-blue text-accent-blue')}
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
