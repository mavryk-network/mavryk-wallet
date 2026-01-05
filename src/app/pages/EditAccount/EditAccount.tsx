import React, { FC, useCallback, useMemo, useState } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import { ReactComponent as EditIcon } from 'app/icons/edit-title.svg';
import { ReactComponent as KeyIcon } from 'app/icons/key.svg';
import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { ListItemWithNavigate, ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';
import AccountBanner from 'app/templates/AccountBanner';
import { T, t } from 'lib/i18n';
import { useAccount, useAllAccounts, useFilteredContacts } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';

import { EditAccountNamePopup } from './popups/EditAccountNamePopup';
import { RemoveAccountPopup } from './popups/RemoveAccountPopup';

export type EditAccountProps = {
  accHash?: string | null;
};

export const EditAccount: FC<EditAccountProps> = ({ accHash }) => {
  const { allContacts: filteredContacts } = useFilteredContacts();
  const accounts = useAllAccounts();
  const account = useMemo(
    () => (accHash ? accounts.find(acc => acc.publicKeyHash === accHash)! : accounts[0]),
    [accHash, accounts]
  );

  const { popup } = useAppEnv();

  const [showEditNamePopup, setShowEditNamePopup] = useState(false);
  const [showRemoveAccountPopup, setShowRemoveAccountPopup] = useState(false);

  const handleEditAccountOpen = useCallback(() => {
    setShowEditNamePopup(true);
  }, []);

  const handleEditAccountClose = useCallback(() => {
    setShowEditNamePopup(false);
  }, []);

  const handleRemoveAccountOpen = useCallback(() => {
    setShowRemoveAccountPopup(true);
  }, []);

  const handleRemoveAccountClose = useCallback(() => {
    setShowRemoveAccountPopup(false);
  }, []);

  const accToChange = filteredContacts.find(acc => acc.address === accHash);

  const isOwn = useMemo(
    () => (accToChange?.accountInWallet ? accToChange.accountInWallet : false),
    [accToChange?.accountInWallet]
  );

  // revealPrivateKey
  const accountOptions: ListItemWithNavigateprops[] = useMemo(
    () => [
      {
        i18nKey: 'editName',
        Icon: EditIcon,
        onClick: handleEditAccountOpen,
        fillIcon: true
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
    <PageLayout pageTitle={<span>{isOwn ? t('editAccount') : t('editContact')}</span>} isTopbarVisible={false}>
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
      {account.type !== TempleAccountType.HD && (
        <ButtonRounded size="big" fill={false} className="w-full" onClick={handleRemoveAccountOpen}>
          <T id="deleteAccount" />
        </ButtonRounded>
      )}

      <EditAccountNamePopup
        opened={showEditNamePopup}
        close={handleEditAccountClose}
        name={account.name}
        accountHash={account.publicKeyHash}
        isOwn={isOwn}
        accToChange={accToChange}
      />

      <RemoveAccountPopup opened={showRemoveAccountPopup} close={handleRemoveAccountClose} />
    </PageLayout>
  );
};
