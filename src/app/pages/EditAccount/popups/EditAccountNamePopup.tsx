import React, { FC, FormEventHandler, useCallback, useEffect, useMemo, useRef } from 'react';

import clsx from 'clsx';

import { FormField } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN_STR } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useContactsActions, useTempleClient } from 'lib/temple/front';
import { TempleContact } from 'lib/temple/types';
import { useAlert } from 'lib/ui';

import { EditableTitleSelectors } from '../editAccount.selectors';
import { useAccountNameInputHandlers } from '../hooks';

type EditAccountNamePopupPeops = {
  opened: boolean;
  close: () => void;
  accountHash: string;
  isOwn: boolean;
  accToChange: TempleContact | undefined;
  name: string;
};

export const EditAccountNamePopup: FC<EditAccountNamePopupPeops> = ({
  opened,
  close,
  accountHash,
  isOwn,
  accToChange,
  name
}) => {
  const { popup } = useAppEnv();
  const { editAccountName } = useTempleClient();
  const customAlert = useAlert();
  const formAnalytics = useFormAnalytics('ChangeAccountName');
  const { editContact } = useContactsActions();

  const editAccNameFieldRef = useRef<HTMLInputElement>(null);
  const accNamePrevRef = useRef<string>();
  const autoCancelTimeoutRef = useRef<number>();

  const accountName = useMemo(() => (accToChange ? accToChange.name : name), [accToChange, name]);

  const { value, handleChange, handleClean } = useAccountNameInputHandlers(accountName, editAccNameFieldRef);

  useEffect(() => {
    accNamePrevRef.current = accountName;
  }, [accountName]);

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

          close();
          formAnalytics.trackSubmitSuccess();
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
    [formAnalytics, accountName, isOwn, close, editAccountName, accountHash, editContact, customAlert]
  );

  const handleEditFieldFocus = useCallback(() => {
    clearTimeout(autoCancelTimeoutRef.current);
  }, []);

  const label = isOwn ? t('enterAccountName') : t('newContactPlaceholder');

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={isOwn ? t('editAccountName') : t('editContactName')}
      portalClassName="edit-account-name-popup-portal"
    >
      <div className={clsx('flex flex-col', popup ? 'px-4' : 'px-12')}>
        <form className="flex flex-col items-center flex-1 justify-start gap-3" onSubmit={handleEditSubmit}>
          <FormField
            ref={editAccNameFieldRef}
            name="name"
            value={value}
            onChange={handleChange}
            maxLength={16}
            label={
              <div className="flex flex-col gap-1 capitalize">
                {label}
                <span className="text-sm text-secondary-white">1-16 characters, no special</span>
              </div>
            }
            placeholder={label}
            pattern={ACCOUNT_NAME_PATTERN_STR}
            title={t('accountNameInputTitle')}
            spellCheck
            onFocus={handleEditFieldFocus}
            cleanBtnBottomOffset="27%"
            onClean={handleClean}
            cleanable={Boolean(value)}
          />

          <ButtonRounded size="big" className="w-full capitalize mt-auto" testID={EditableTitleSelectors.saveButton}>
            <T id="save" />
          </ButtonRounded>
        </form>
      </div>
    </PopupModalWithTitle>
  );
};
