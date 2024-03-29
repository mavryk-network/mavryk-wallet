import { useCallback } from 'react';

// import { useUserTestingGroupNameSelector } from 'app/store/ab-testing/selectors';
import { useAnalyticsEnabledSelector } from 'app/store/settings/selectors';
import { AnalyticsEventCategory } from 'lib/temple/analytics-types';

// import { sendPageEvent, sendTrackEvent } from './send-events.utils';
// import { useAnalyticsNetwork } from './use-analytics-network.hook';

export const useAnalytics = () => {
  const analyticsEnabled = useAnalyticsEnabledSelector();
  // const userId = useUserIdSelector();
  // const rpc = useAnalyticsNetwork();
  // const testGroupName = useUserTestingGroupNameSelector();

  const trackEvent = useCallback(
    (
      event: string,
      category: AnalyticsEventCategory = AnalyticsEventCategory.General,
      properties?: object,
      isAnalyticsEnabled = analyticsEnabled
    ) => {
      console.log(event, category, properties, isAnalyticsEnabled);
      return;
      // return (
      //   isAnalyticsEnabled &&
      //   sendTrackEvent(userId, rpc, event, category, { ...properties, abTestingCategory: testGroupName })
      // );
    },
    [analyticsEnabled]
  );

  const pageEvent = useCallback((path: string, search: string, additionalProperties = {}) => {
    console.log(path, search, additionalProperties);
    return;
    // return (
    //   analyticsEnabled &&
    //   sendPageEvent(userId, rpc, path, search, { ...additionalProperties, abTestingCategory: testGroupName })
    // );
  }, []);

  return {
    trackEvent,
    pageEvent
  };
};
