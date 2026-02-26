import React, { FC } from 'react';

import { EnablingSetting } from 'app/templates/SettingsGeneral/Components/EnablingSetting';
import { SettingsGeneralSelectors } from 'app/templates/SettingsGeneral/selectors';
import { uiStore, useIsNewsEnabled } from 'lib/store/zustand/ui.store';

export const NotificationsSettings: FC = () => {
  const isNewsEnabled = useIsNewsEnabled();

  const handleNewsNotificationsChange = (checked: boolean) => uiStore.getState().setIsNewsEnabled(checked);

  return (
    <EnablingSetting
      titleI18nKey="notifications"
      descriptionI18nKey="notificationsSettingsDescription"
      enabled={isNewsEnabled}
      onChange={handleNewsNotificationsChange}
      testID={SettingsGeneralSelectors.notificationCheckBox}
    />
  );
};
