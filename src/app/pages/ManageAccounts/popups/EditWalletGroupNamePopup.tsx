import React, { FC, FormEventHandler, useCallback, useEffect, useRef, useState } from 'react';

import clsx from 'clsx';

import { FormField } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN_STR } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useTempleClient } from 'lib/temple/front';
import { DisplayedGroup } from 'lib/temple/types';
import { useAlert } from 'lib/ui';

type EditWalletGroupNamePopupProps = {
  opened: boolean;
  close: () => void;
  group: DisplayedGroup;
};

export const EditWalletGroupNamePopup: FC<EditWalletGroupNamePopupProps> = ({ opened, close, group }) => {
  const { name: walletName, id: walletId } = group;
  const { popup } = useAppEnv();
  const { editHdGroupName } = useTempleClient();
  const customAlert = useAlert();
  const formAnalytics = useFormAnalytics('ChangeGroupName');

  const editWalletNameFieldRef = useRef<HTMLInputElement>(null);
  const walletNamePrevref = useRef<string>();
  const autoCancelTimeoutRef = useRef<number>();

  const [value, setValue] = useState(walletName);
  const handleChange = useCallback((e: { target: { value: React.SetStateAction<string> } }) => {
    setValue(e.target.value);
  }, []);

  const handleClean = useCallback(() => {
    setValue('');
    if (editWalletNameFieldRef.current) {
      editWalletNameFieldRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    walletNamePrevref.current = walletName;
  }, [walletName]);

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
          const newName = editWalletNameFieldRef.current?.value;
          if (newName) {
            await editHdGroupName(walletId, newName);
          }

          close();
          formAnalytics.trackSubmitSuccess();
        } catch (err: any) {
          formAnalytics.trackSubmitFail();

          console.error(err);

          await customAlert({
            title: t('errorChangingWalletName'),
            children: err.message
          });
        }
      })();
    },
    [formAnalytics, close, editHdGroupName, walletId, customAlert]
  );

  const handleEditFieldFocus = useCallback(() => {
    clearTimeout(autoCancelTimeoutRef.current);
  }, []);

  const label = 'renameWallet';

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={t('renameWallet')}
      portalClassName="edit-account-name-popup-portal"
    >
      <div className={clsx('flex flex-col', popup ? 'px-4' : 'px-12')}>
        <form className="flex flex-col items-center flex-1 justify-start gap-3" onSubmit={handleEditSubmit}>
          <FormField
            ref={editWalletNameFieldRef}
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

          <ButtonRounded size="big" className="w-full capitalize mt-auto">
            <T id="save" />
          </ButtonRounded>
        </form>
      </div>
    </PopupModalWithTitle>
  );
};
