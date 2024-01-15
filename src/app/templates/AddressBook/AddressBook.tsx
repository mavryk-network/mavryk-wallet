import React, { useCallback, useMemo } from 'react';

import classNames from 'clsx';
import { useForm } from 'react-hook-form';

import { Name, Identicon, FormField, FormSubmitButton, HashChip, SubTitle } from 'app/atoms';
import { ReactComponent as CloseIcon } from 'app/icons/close.svg';
import { setAnotherSelector, setTestID } from 'lib/analytics';
import { t, T } from 'lib/i18n';
import { isDomainNameValid, useTezosDomainsClient, useContactsActions, useFilteredContacts } from 'lib/temple/front';
import { isAddressValid } from 'lib/temple/helpers';
import { TempleContact } from 'lib/temple/types';
import { useConfirm } from 'lib/ui/dialog';
import { delay } from 'lib/utils';

import CustomSelect, { OptionRenderProps } from '../CustomSelect';
import { AddressBookSelectors } from './AddressBook.selectors';

type ContactActions = {
  remove: (address: string) => void;
};

const AddressBook: React.FC = () => {
  const { removeContact } = useContactsActions();
  const { allContacts } = useFilteredContacts();
  const confirm = useConfirm();

  const handleRemoveContactClick = useCallback(
    async (address: string) => {
      if (
        !(await confirm({
          title: t('actionConfirmation'),
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

  return (
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

export default AddressBook;

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
