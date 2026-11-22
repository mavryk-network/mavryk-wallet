import React, { useCallback } from 'react';

import { useAnalyticsEnabledSelector } from 'app/store/settings/selectors';
import { requestBrowserAnalyticsConsent } from 'lib/analytics/browser-consent';
import { setAnalyticsConsent, trackAnalyticsEvent } from 'lib/analytics/send-events.utils';

import { SettingsGeneralSelectors } from '../selectors';

import { EnablingSetting } from './EnablingSetting';

const AnalyticsSettings: React.FC = () => {
  const analyticsEnabled = useAnalyticsEnabledSelector();

  const handleAnalyticsToggle = useCallback(async (isEnabled: boolean) => {
    // Firefox needs its own data consent prompt, which must be requested directly from the click.
    if (isEnabled) await requestBrowserAnalyticsConsent();

    await setAnalyticsConsent(isEnabled);

    if (isEnabled) trackAnalyticsEvent('analytics_opt_in_changed', { enabled: true });
  }, []);

  return (
    <EnablingSetting
      titleI18nKey="analyticsSettings"
      descriptionI18nKey="analyticsSettingsDescription"
      enabled={analyticsEnabled}
      onChange={handleAnalyticsToggle}
      testID={SettingsGeneralSelectors.anonymousAnalyticsCheckBox}
    />
  );
};

export default AnalyticsSettings;
