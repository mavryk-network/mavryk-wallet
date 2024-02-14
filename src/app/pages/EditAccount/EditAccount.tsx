import React, { FC, FormEventHandler, useCallback, useEffect, useMemo, useRef } from 'react';

import { FormField, HashChip } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN } from 'app/defaults';
import { ReactComponent as TrashIcon } from 'app/icons/trash.svg';
import PageLayout from 'app/layouts/PageLayout';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import {
  useAccount,
  useContactsActions,
  useFilteredContacts,
  useSetAccountPkh,
  useTempleClient
} from 'lib/temple/front';
import { useAlert } from 'lib/ui';
import { useConfirm } from 'lib/ui/dialog';
import { goBack, navigate } from 'lib/woozie';

import { EditableTitleSelectors } from './editAccount.selectors';

export type EditAccountProps = {
  accHash?: string | null;
};

export const EditAccount: FC<EditAccountProps> = ({ accHash }) => {
  const { editAccountName } = useTempleClient();
  const setAccountPkh = useSetAccountPkh();
  const { allContacts: filteredContacts } = useFilteredContacts();
  const { removeContact, editContact } = useContactsActions();
  const account = useAccount();
  const customAlert = useAlert();
  const formAnalytics = useFormAnalytics('ChangeAccountName');
  const confirm = useConfirm();

  const editAccNameFieldRef = useRef<HTMLInputElement>(null);
  const accNamePrevRef = useRef<string>();

  const accToChange = filteredContacts.find(acc => acc.address === accHash);

  const accountHash = useMemo(
    () => (accToChange ? accToChange.address : account.publicKeyHash),
    [accToChange, account.publicKeyHash]
  );
  const accountName = useMemo(() => (accToChange ? accToChange.name : account.name), [accToChange, account.name]);
  const isOwn = useMemo(
    () => (accToChange?.accountInWallet ? accToChange.accountInWallet : false),
    [accToChange?.accountInWallet]
  );

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
          if (newName && newName !== accountName && isOwn) {
            // update "own" account name
            await editAccountName(accountHash, newName);
          } else if (!isOwn && newName && newName !== accountName) {
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
      // navigate to the /sremove-account screen
      return navigate('/settings/remove-account');
    }

    if (
      !(await confirm({
        title: t('deleteContact'),
        children: t('deleteContactConfirm'),
        comfirmButtonText: t('delete')
      }))
    ) {
      return;
    }

    await removeContact(accountHash);
  }, [accountHash, confirm, isOwn, removeContact, setAccountPkh]);

  const handleEditFieldFocus = useCallback(() => {
    clearTimeout(autoCancelTimeoutRef.current);
  }, []);

  return (
    <PageLayout
      pageTitle={
        <>
          <T id="editAccount" />
        </>
      }
      isTopbarVisible={false}
      RightSidedComponent={
        <button className="flex-none text-white" onClick={handleRemoveContactClick}>
          <TrashIcon className="w-5 h-5" title={t('remove')} />
        </button>
      }
    >
      <div className="w-full max-w-sm mx-auto h-full flex flex-col justify-start pb-8">
        <div className="flex flex-col gap-1 mb-4">
          <div className="text-primary-white text-base-plus">
            <T id="publicAddress" />:
          </div>
          <HashChip hash={accountHash} small trim={false} />
        </div>
        <form className="flex flex-col items-center flex-1 justify-between" onSubmit={handleEditSubmit}>
          <FormField
            ref={editAccNameFieldRef}
            name="name"
            defaultValue={accountName}
            maxLength={16}
            label={t('accountName')}
            placeholder={t('enterAccountName')}
            pattern={ACCOUNT_NAME_PATTERN.toString().slice(1, -1)}
            title={t('accountNameInputTitle')}
            spellCheck={false}
            onFocus={handleEditFieldFocus}
          />

          <ButtonRounded size="big" className="w-full capitalize" testID={EditableTitleSelectors.saveButton}>
            <T id="save" />
          </ButtonRounded>
        </form>
      </div>
    </PageLayout>
  );
};
