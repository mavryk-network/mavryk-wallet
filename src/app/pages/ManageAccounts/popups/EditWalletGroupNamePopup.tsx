import React, { FC, useCallback } from 'react';

import { EditNamePopup } from 'app/templates/EditNamePopup';
import { t } from 'lib/i18n';
import { useTempleClient } from 'lib/temple/front';
import { DisplayedGroup } from 'lib/temple/types';

type EditWalletGroupNamePopupProps = {
  opened: boolean;
  close: () => void;
  group: DisplayedGroup;
};

export const EditWalletGroupNamePopup: FC<EditWalletGroupNamePopupProps> = ({ opened, close, group }) => {
  const { name: walletName, id: walletId } = group;
  const { editHdGroupName } = useTempleClient();

  const handleSave = useCallback(
    async (newName: string) => {
      await editHdGroupName(walletId, newName);
    },
    [editHdGroupName, walletId]
  );

  return (
    <EditNamePopup
      opened={opened}
      close={close}
      currentName={walletName}
      label="renameWallet"
      popupTitle={t('renameWallet')}
      errorAlertTitle={t('errorChangingWalletName')}
      analyticsFormName="ChangeGroupName"
      onSave={handleSave}
    />
  );
};
