import React, { FC, useCallback, useMemo } from 'react';

import { EditNamePopup } from 'app/templates/EditNamePopup';
import { t } from 'lib/i18n';
import { useContactsActions, useTempleClient } from 'lib/temple/front';
import { TempleContact } from 'lib/temple/types';

import { EditableTitleSelectors } from '../editAccount.selectors';

type EditAccountNamePopupProps = {
  opened: boolean;
  close: () => void;
  accountHash: string;
  isOwn: boolean;
  accToChange: TempleContact | undefined;
  name: string;
};

export const EditAccountNamePopup: FC<EditAccountNamePopupProps> = ({
  opened,
  close,
  accountHash,
  isOwn,
  accToChange,
  name
}) => {
  const { editAccountName } = useTempleClient();
  const { editContact } = useContactsActions();

  const accountName = useMemo(() => (accToChange ? accToChange.name : name), [accToChange, name]);

  const handleSave = useCallback(
    async (newName: string) => {
      if (isOwn) {
        await editAccountName(accountHash, newName);
      } else {
        await editContact(accountHash, { name: newName });
      }
    },
    [isOwn, editAccountName, accountHash, editContact]
  );

  return (
    <EditNamePopup
      opened={opened}
      close={close}
      currentName={accountName}
      label={isOwn ? t('enterAccountName') : t('newContactPlaceholder')}
      popupTitle={isOwn ? t('editAccountName') : t('editContactName')}
      errorAlertTitle={t('errorChangingAccountName')}
      analyticsFormName="ChangeAccountName"
      onSave={handleSave}
      testID={EditableTitleSelectors.saveButton}
    />
  );
};
