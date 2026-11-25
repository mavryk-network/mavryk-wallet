import { getReadyAnalyticsIdentity } from 'lib/store/zustand/ui-owner';
import { TempleSendPageEventRequest, TempleSendTrackEventRequest } from 'lib/temple/analytics-types';

// Transport remains disabled. All entry points enforce restored identity/consent before any future transport call.
export const trackEvent = async (_request: Omit<TempleSendTrackEventRequest, 'type'>) => {
  if (!getReadyAnalyticsIdentity()) return;
};

export const pageEvent = async (_request: Omit<TempleSendPageEventRequest, 'type'>) => {
  if (!getReadyAnalyticsIdentity()) return;
};
