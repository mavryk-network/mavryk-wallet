import React, { useCallback, useEffect, useMemo } from 'react';

import classNames from 'clsx';

import { Name, Identicon, HashChip } from 'app/atoms';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { TabComponentProps } from 'app/pages/Settings/Settings';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { t, T } from 'lib/i18n';
import { useContactsActions, useFilteredContacts, useAccount } from 'lib/temple/front';
import { TempleContact } from 'lib/temple/types';
import { useConfirm } from 'lib/ui/dialog';
import { navigate } from 'lib/woozie';

import CustomSelect, { OptionRenderProps } from '../CustomSelect';
import { AddressBookSelectors } from './AddressBook.selectors';

type ContactActions = {
  remove: (address: string) => void;
};

export const AddressBook: React.FC<TabComponentProps> = ({ setToolbarRightSidedComponent }) => {
  const { removeContact } = useContactsActions();
  const { allContacts: filteredContacts } = useFilteredContacts();
  const account = useAccount();
  const confirm = useConfirm();

  const allContacts = useMemo(
    () => filteredContacts.filter(contact => contact.address !== account.publicKeyHash),
    [account.publicKeyHash, filteredContacts]
  );

  const isContactsEmpty = allContacts.length === 0;

  const handleAddContactClick = useCallback(() => {
    navigate('/settings/add-contact');
  }, []);

  const handleRemoveContactClick = useCallback(
    async (address: string) => {
      if (
        !(await confirm({
          title: t('deleteContact'),
          children: t('deleteContactConfirm')
        }))
      ) {
        return;
      }

      await removeContact(address);
    },
    [confirm, removeContact]
  );

  const contactActions = useMemo<ContactActions>(
    () => ({
      remove: handleRemoveContactClick
    }),
    [handleRemoveContactClick]
  );

  const AddComponent = useMemo(
    () => (
      <div className="text-base-plus text-accent-blue cursor-pointer" onClick={handleAddContactClick}>
        Add
      </div>
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

  return isContactsEmpty ? (
    <section className="w-full h-full flex justify-center items-center">
      <div className="flex flex-col">
        <div className="text-base-plus text-white mb-2">
          <T id="noContacts" />
        </div>
        <div className="text-sm text-secondary-white mb-4">
          <T id="addAddresesDesc" />
        </div>
        <ButtonRounded size="small" className="self-center" onClick={handleAddContactClick} fill>
          <T id="addAddress" />
        </ButtonRounded>
      </div>
    </section>
  ) : (
    <div className="w-full max-w-sm mx-auto -mt-3">
      <CustomSelect
        actions={contactActions}
        className="mb-6 p-0"
        getItemId={getContactKey}
        items={allContacts}
        OptionIcon={ContactIcon}
        OptionContent={ContactContent}
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

const ContactContent: React.FC<OptionRenderProps<TempleContact, string, ContactActions>> = ({ item, actions }) => (
  <div
    className="flex flex-1 w-full py-3"
    {...setTestID(AddressBookSelectors.contactItem)}
    {...setAnotherSelector('hash', item.address)}
  >
    <div className="flex flex-col justify-between flex-1">
      <div className="flex items-center">
        <Name className="mb-px text-base-plus text-white text-left">{item.name}</Name>
        {item.accountInWallet && (
          <div className="flex items-cente">
            <span
              className={classNames('p-1 ml-1 rounded border text-xs border-accent-blue text-accent-blue')}
              {...setTestID(AddressBookSelectors.contactOwnLabelText)}
            >
              <T id="ownAccount" />
            </span>
          </div>
        )}
      </div>

      <div className="text-sm mt-1">
        <HashChip hash={item.address} small />
      </div>
    </div>

    {!item.accountInWallet && (
      <button
        className="flex-none py-2 text-white hover:text-gray-600 transition ease-in-out duration-200"
        onClick={evt => {
          evt.stopPropagation();
          actions?.remove(item.address);
        }}
        {...setTestID(AddressBookSelectors.deleteContactButton)}
        {...setAnotherSelector('hash', item.address)}
      >
        <CloseIcon className="w-5 h-auto text-white stroke-current stroke-2" title={t('delete')} />
      </button>
    )}
  </div>
);

function getContactKey(contract: TempleContact) {
  return contract.address;
}
