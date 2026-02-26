import React, { FC, FormEventHandler, useCallback, useEffect, useRef, useState } from 'react';

import clsx from 'clsx';

import { FormField } from 'app/atoms';
import { ACCOUNT_NAME_PATTERN_STR } from 'app/defaults';
import { useAppEnv } from 'app/env';
import { ButtonRounded } from 'app/molecules/ButtonRounded';
import { PopupModalWithTitle } from 'app/templates/PopupModalWithTitle';
import { useFormAnalytics } from 'lib/analytics';
import { T, t } from 'lib/i18n';
import { useAlert } from 'lib/ui';

import { TestIDProperty } from '../../lib/analytics';

interface EditNamePopupProps extends TestIDProperty {
  opened: boolean;
  close: () => void;
  currentName: string;
  /** Label text shown above the input field */
  label: string;
  /** Title shown in the popup header */
  popupTitle: string;
  /** Error alert title shown on failure */
  errorAlertTitle: string;
  /** Form analytics identifier */
  analyticsFormName: string;
  /** Called with the new name when user submits; should throw on error */
  onSave: (newName: string) => Promise<void>;
}

export const EditNamePopup: FC<EditNamePopupProps> = ({
  opened,
  close,
  currentName,
  label,
  popupTitle,
  errorAlertTitle,
  analyticsFormName,
  onSave,
  testID
}) => {
  const { popup } = useAppEnv();
  const customAlert = useAlert();
  const formAnalytics = useFormAnalytics(analyticsFormName);

  const editNameFieldRef = useRef<HTMLInputElement>(null);
  const namePrevRef = useRef<string>();
  const autoCancelTimeoutRef = useRef<number>();

  const [value, setValue] = useState(currentName);
  const handleChange = useCallback((e: { target: { value: React.SetStateAction<string> } }) => {
    setValue(e.target.value);
  }, []);

  const handleClean = useCallback(() => {
    setValue('');
    if (editNameFieldRef.current) {
      editNameFieldRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    namePrevRef.current = currentName;
  }, [currentName]);

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
          const newName = editNameFieldRef.current?.value;
          if (newName && newName !== currentName) {
            await onSave(newName);
          }

          close();
          formAnalytics.trackSubmitSuccess();
        } catch (err: any) {
          formAnalytics.trackSubmitFail();

          console.error(err);

          await customAlert({
            title: errorAlertTitle,
            children: err.message
          });
        }
      })();
    },
    [formAnalytics, currentName, close, onSave, customAlert, errorAlertTitle]
  );

  const handleEditFieldFocus = useCallback(() => {
    clearTimeout(autoCancelTimeoutRef.current);
  }, []);

  return (
    <PopupModalWithTitle
      isOpen={opened}
      contentPosition={popup ? 'bottom' : 'center'}
      onRequestClose={close}
      title={popupTitle}
      portalClassName="edit-account-name-popup-portal"
    >
      <div className={clsx('flex flex-col', popup ? 'px-4' : 'px-12')}>
        <form className="flex flex-col items-center flex-1 justify-start gap-3" onSubmit={handleEditSubmit}>
          <FormField
            ref={editNameFieldRef}
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

          <ButtonRounded size="big" className="w-full capitalize mt-auto" testID={testID}>
            <T id="save" />
          </ButtonRounded>
        </form>
      </div>
    </PopupModalWithTitle>
  );
};
