import React, { FC, useCallback, useMemo, useState } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import { ReactComponent as KeyIcon } from 'app/icons/key.svg';
import { ReactComponent as TrashIcon } from 'app/icons/trash.svg';
import PageLayout from 'app/layouts/PageLayout';
import { BTN_ERROR } from 'app/molecules/ButtonRounded';
import { ListItemWithNavigate, ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';
import AccountBanner from 'app/templates/AccountBanner';
import { t } from 'lib/i18n';
import { useAccount, useContactsActions, useFilteredContacts, useSetAccountPkh } from 'lib/temple/front';
import { useConfirm } from 'lib/ui/dialog';
import { goBack, navigate } from 'lib/woozie';

import { EditAccountNamePopup } from './popups/EditAccountNamePopup';

export type EditAccountProps = {
  accHash?: string | null;
};

export const EditAccount: FC<EditAccountProps> = ({ accHash }) => {
  const setAccountPkh = useSetAccountPkh();
  const { allContacts: filteredContacts } = useFilteredContacts();
  const { removeContact } = useContactsActions();
  const account = useAccount();

  const confirm = useConfirm();
  const { popup } = useAppEnv();

  const [showEditNamePopup, setShowEditNamePopup] = useState(false);

  const handleEditAccountOpen = useCallback(() => {
    setShowEditNamePopup(true);
  }, []);

  const handleEditAccountClose = useCallback(() => {
    setShowEditNamePopup(false);
  }, []);

  const accToChange = filteredContacts.find(acc => acc.address === accHash);

  const accountHash = useMemo(
    () => (accToChange ? accToChange.address : account.publicKeyHash),
    [accToChange, account.publicKeyHash]
  );
  const isOwn = useMemo(
    () => (accToChange?.accountInWallet ? accToChange.accountInWallet : false),
    [accToChange?.accountInWallet]
  );

  const handleRemoveContactClick = useCallback(async () => {
    if (isOwn) {
      // switch acc so u will see proper acc on the settings/remove-account screen
      setAccountPkh(accountHash);
      // navigate to the /sremove-account screen
      return navigate('/settings/remove-account');
    }

    if (
      !(await confirm({
        title: t('deleteContact'),
        children: t('deleteContactConfirm'),
        comfirmButtonText: t('delete'),
        confirmButtonType: BTN_ERROR
      }))
    ) {
      return;
    }

    await removeContact(accountHash);
    goBack();
  }, [accountHash, confirm, isOwn, removeContact, setAccountPkh]);

  // revealPrivateKey
  const accountOptions: ListItemWithNavigateprops[] = useMemo(
    () => [
      {
        i18nKey: 'editName',
        Icon: KeyIcon,
        onClick: handleEditAccountOpen,
        fillIcon: false
      },
      {
        linkTo: '/settings/reveal-private-key',
        i18nKey: 'revealPrivateKey',
        Icon: KeyIcon,
        fillIcon: false
      }
    ],
    [handleEditAccountOpen]
  );

  return (
    <PageLayout
      pageTitle={<span>{isOwn ? t('editAccount') : t('editContact')}</span>}
      isTopbarVisible={false}
      RightSidedComponent={
        <button className="flex-none text-white" onClick={handleRemoveContactClick}>
          <TrashIcon className="w-5 h-5" title={t('remove')} />
        </button>
      }
    >
      <div
        className={clsx(
          'w-full mx-auto h-full flex flex-col justify-start flex-1',
          popup ? 'max-w-sm pb-8' : 'max-w-screen-xxs'
        )}
      >
        <div className="flex flex-col gap-1">
          <AccountBanner account={account} restrictAccountSelect />
        </div>

        <ul className={clsx('flex flex-col pb-4')}>
          {accountOptions.map(({ ...option }) => (
            <ListItemWithNavigate key={option.i18nKey} {...option} paddingClassName="py-4" fullWidthDivider />
          ))}
        </ul>
      </div>
      <EditAccountNamePopup
        opened={showEditNamePopup}
        close={handleEditAccountClose}
        name={account.name}
        accountHash={account.publicKeyHash}
        isOwn={isOwn}
        accToChange={accToChange}
      />
    </PageLayout>
  );
};
