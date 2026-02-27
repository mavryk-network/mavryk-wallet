import { useEffect, useRef } from 'react';

import { useAnalytics } from 'lib/analytics';
import { WEBSITES_ANALYTICS_ENABLED } from 'lib/constants';
import { useIsAnalyticsEnabled, useShouldShowPromotion } from 'lib/store/zustand/ui.store';
import { AnalyticsEventCategory } from 'lib/temple/analytics-types';
import { useAccountPkh } from 'lib/temple/front';
import { usePassiveStorage } from 'lib/temple/front/storage';

export const useUserAnalyticsAndAdsSettings = () => {
  const { trackEvent } = useAnalytics();
  const isAnalyticsEnabled = useIsAnalyticsEnabled();
  const isAdsEnabled = useShouldShowPromotion();

  const [, setIsWebsitesAnalyticsEnabled] = usePassiveStorage(WEBSITES_ANALYTICS_ENABLED);
  const prevWebsiteAnalyticsEnabledRef = useRef(isAnalyticsEnabled && isAdsEnabled);
  const accountPkh = useAccountPkh();

  useEffect(() => {
    const shouldEnableAnalyticsAndAds = isAnalyticsEnabled && isAdsEnabled;

    setIsWebsitesAnalyticsEnabled(shouldEnableAnalyticsAndAds);

    if (shouldEnableAnalyticsAndAds && !prevWebsiteAnalyticsEnabledRef.current) {
      trackEvent('AnalyticsAndAdsEnabled', AnalyticsEventCategory.General, { accountPkh });
    }
    prevWebsiteAnalyticsEnabledRef.current = shouldEnableAnalyticsAndAds;
  }, [isAnalyticsEnabled, isAdsEnabled, setIsWebsitesAnalyticsEnabled, trackEvent, accountPkh]);
};
