import { useCallback } from 'react';

import { useAnalyticsEnabledSelector } from 'app/store/settings/selectors';
import { AnalyticsEventCategory } from 'lib/temple/analytics-types';

/** Transport remains disabled. Restored consent is required even when a caller passes an explicit opt-in. */
export const useAnalytics = () => {
  const analyticsEnabled = useAnalyticsEnabledSelector();
  const trackEvent = useCallback(
    (
      _event: string,
      _category: AnalyticsEventCategory = AnalyticsEventCategory.General,
      _properties?: object,
      isAnalyticsEnabled = analyticsEnabled
    ) => {
      if (!analyticsEnabled || !isAnalyticsEnabled) return;
    },
    [analyticsEnabled]
  );
  const pageEvent = useCallback(
    (_path: string, _search: string, _additionalProperties = {}) => {
      if (!analyticsEnabled) return;
    },
    [analyticsEnabled]
  );
  return { trackEvent, pageEvent };
};
