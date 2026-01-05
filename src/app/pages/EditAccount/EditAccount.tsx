import React, { FC, FormEventHandler, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import clsx from 'clsx';

import { FormField, HashChip } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { ReactComponent as EditIcon } from 'app/icons/edit-title.svg';
import { ReactComponent as KeyIcon } from 'app/icons/key.svg';
import { ReactComponent as TrashIcon } from 'app/icons/trash.svg';
import PageLayout from 'app/layouts/PageLayout';
import { BTN_ERROR, ButtonRounded } from 'app/molecules/ButtonRounded';
import { ListItemWithNavigate, ListItemWithNavigateprops } from 'app/molecules/ListItemWithNavigate';
import AccountBanner from 'app/templates/AccountBanner';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useAccount, useAllAccounts, useContactsActions, useSetAccountPkh, useTempleClient } from 'lib/temple/front';
import { TempleAccountType } from 'lib/temple/types';
import { useAlert } from 'lib/ui';
import { useConfirm } from 'lib/ui/dialog';
import { goBack, navigate } from 'lib/woozie';

import { EditableTitleSelectors } from './editAccount.selectors';
import { useAccountNameInputHandlers, useAccountOwnership, usePopupState } from './hooks';
import { EditAccountNamePopup } from './popups/EditAccountNamePopup';
import { RemoveAccountPopup } from './popups/RemoveAccountPopup';

export type EditAccountProps = {
  accHash?: string | null;
};

export const EditAccount: FC<EditAccountProps> = ({ accHash }) => {
  const { isOwn } = useAccountOwnership(accHash);

  return isOwn ? <EditOwnAccount accHash={accHash} /> : <EditContact accHash={accHash} />;
};

export const EditOwnAccount: FC<EditAccountProps> = ({ accHash }) => {
  const accounts = useAllAccounts();
  const { popup } = useAppEnv();

  const account = useMemo(
    () => (accHash ? accounts.find(acc => acc.publicKeyHash === accHash)! : accounts[0]),
    [accHash, accounts]
  );

  const { accToChange, isOwn } = useAccountOwnership(accHash);

  const editNamePopup = usePopupState(false);
  const removeAccountPopup = usePopupState(false);

  const accountOptions: ListItemWithNavigateprops[] = useMemo(
    () => [
      { i18nKey: 'editName', Icon: EditIcon, onClick: editNamePopup.open, fillIcon: true },
      { linkTo: '/settings/reveal-private-key', i18nKey: 'revealPrivateKey', Icon: KeyIcon, fillIcon: false }
    ],
    [editNamePopup.open]
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
          {accountOptions.map(option => (
            <ListItemWithNavigate key={option.i18nKey} {...option} paddingClassName="py-4" fullWidthDivider />
          ))}
        </ul>
      </div>

      {account.type !== TempleAccountType.HD && (
        <ButtonRounded btnType={BTN_ERROR} size="big" fill={false} className="w-full" onClick={removeAccountPopup.open}>
          <T id="deleteAccount" />
        </ButtonRounded>
      )}

      <EditAccountNamePopup
        opened={editNamePopup.opened}
        close={editNamePopup.close}
        name={account.name}
        accountHash={account.publicKeyHash}
        isOwn={isOwn}
        accToChange={accToChange}
      />

      <RemoveAccountPopup opened={removeAccountPopup.opened} close={removeAccountPopup.close} />
    </PageLayout>
  );
};

export const EditContact: FC<EditAccountProps> = ({ accHash }) => {
  const { editAccountName } = useTempleClient();
  const setAccountPkh = useSetAccountPkh();
  const { removeContact, editContact } = useContactsActions();
  const account = useAccount();
  const customAlert = useAlert();
  const formAnalytics = useFormAnalytics('ChangeAccountName');
  const confirm = useConfirm();
  const { popup } = useAppEnv();

  const { accToChange, isOwn } = useAccountOwnership(accHash);

  const editAccNameFieldRef = useRef<HTMLInputElement>(null);
  const accNamePrevRef = useRef<string>();

  const accountHash = useMemo(
    () => (accToChange ? accToChange.address : account.publicKeyHash),
    [accToChange, account.publicKeyHash]
  );

  const accountName = useMemo(() => (accToChange ? accToChange.name : account.name), [accToChange, account.name]);

  const { value, handleChange, handleClean } = useAccountNameInputHandlers(accountName, editAccNameFieldRef);
  useEffect(() => {
    accNamePrevRef.current = accountName;
  }, [accountName]);

  const autoCancelTimeoutRef = useRef<number>();

  useEffect(
    () => () => {
      clearTimeout(autoCancelTimeoutRef.current);
    },
    []
  );

  const handleEditSubmit = useCallback<FormEventHandler>(
    evt => {
      evt.preventDefault();

      (async () => {
        formAnalytics.trackSubmit();
        try {
          const newName = editAccNameFieldRef.current?.value;

          if (!newName || newName === accountName) {
            goBack();
            return;
          }

          if (isOwn) {
            // update "own" account name
            await editAccountName(accountHash, newName);
          } else {
            // update contact from address book
            await editContact(accountHash, { name: newName });
          }

          formAnalytics.trackSubmitSuccess();
          goBack();
        } catch (err: any) {
          formAnalytics.trackSubmitFail();
          console.error(err);

          await customAlert({
            title: t('errorChangingAccountName'),
            children: err.message
          });
        }
      })();
    },
    [formAnalytics, accountName, isOwn, editAccountName, accountHash, editContact, customAlert]
  );

  const handleRemoveContactClick = useCallback(async () => {
    if (isOwn) {
      // switch acc so u will see proper acc on the settings/remove-account screen
      setAccountPkh(accountHash);
      // navigate to the /settings/remove-account screen
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

  const handleEditFieldFocus = useCallback(() => {
    clearTimeout(autoCancelTimeoutRef.current);
  }, []);

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
          'w-full mx-auto h-full flex flex-col justify-start pb-8',
          popup ? 'max-w-sm' : 'max-w-screen-xxs'
        )}
      >
        <div className="flex flex-col gap-1 mb-4">
          <div className="text-primary-white text-base-plus">
            <T id="publicAddress" />:
          </div>
          <HashChip hash={accountHash} small trim={false} />
        </div>

        <form className="flex flex-col items-center flex-1 justify-start gap-3" onSubmit={handleEditSubmit}>
          <FormField
            ref={editAccNameFieldRef}
            name="name"
            value={value}
            onChange={handleChange}
            maxLength={16}
            label={isOwn ? t('editAccountName') : t('editContactName')}
            placeholder={t('enterAccountName')}
            pattern={ACCOUNT_NAME_PATTERN.toString()}
            title={t('accountNameInputTitle')}
            spellCheck={false}
            onFocus={handleEditFieldFocus}
            cleanBtnBottomOffset="27%"
            onClean={handleClean}
            cleanable={Boolean(value)}
          />

          <ButtonRounded size="big" className="w-full capitalize" testID={EditableTitleSelectors.saveButton}>
            <T id="save" />
          </ButtonRounded>
        </form>
      </div>
    </PageLayout>
  );
};
