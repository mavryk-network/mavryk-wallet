import React, { FC } from 'react';

import clsx from 'clsx';

import { useAppEnv } from 'app/env';
import AnalyticsSettings from 'app/templates/SettingsGeneral/Components/AnalyticsSettings';
import BlockExplorerSelect from 'app/templates/SettingsGeneral/Components/BlockExplorerSelect';
import FiatCurrencySelect from 'app/templates/SettingsGeneral/Components/FiatCurrencySelect';
import LocaleSelect from 'app/templates/SettingsGeneral/Components/LocaleSelect';
import LockUpSettings from 'app/templates/SettingsGeneral/Components/LockUpSettings';
import PopupSettings from 'app/templates/SettingsGeneral/Components/PopupSettings';
import { NotificationsSettings } from 'lib/notifications/components';

const GeneralSettings: FC = () => {
  const { popup } = useAppEnv();

  return (
    <div className={clsx('w-full mx-auto', popup ? 'max-w-sm pb-8' : 'max-w-screen-xxs')}>
      <FiatCurrencySelect />

      <LocaleSelect />

      <BlockExplorerSelect />

      <PopupSettings />

      <LockUpSettings />

      <AnalyticsSettings />

      <NotificationsSettings />
    </div>
  );
};

export default GeneralSettings;
