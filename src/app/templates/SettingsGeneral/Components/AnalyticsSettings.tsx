import React from 'react';

import { useIsAnalyticsEnabled, uiStore } from 'lib/store/zustand/ui.store';

import { SettingsGeneralSelectors } from '../selectors';

import { EnablingSetting } from './EnablingSetting';

const AnalyticsSettings: React.FC = () => {
  const analyticsEnabled = useIsAnalyticsEnabled();

  const setAnalyticsEnabled = () => uiStore.getState().setAnalyticsEnabled(!analyticsEnabled);

  return (
    <EnablingSetting
      titleI18nKey="analyticsSettings"
      descriptionI18nKey="analyticsSettingsDescription"
      enabled={analyticsEnabled}
      onChange={setAnalyticsEnabled}
      testID={SettingsGeneralSelectors.anonymousAnalyticsCheckBox}
    />
  );
};

export default AnalyticsSettings;
