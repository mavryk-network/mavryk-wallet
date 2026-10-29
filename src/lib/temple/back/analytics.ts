import { getReadyAnalyticsIdentity } from 'lib/store/zustand/ui-owner';
import { TempleSendPageEventRequest, TempleSendTrackEventRequest } from 'lib/temple/analytics-types';

type AnalyticsTrackProperties = Record<string, unknown>;

// Transport remains disabled. All entry points enforce restored identity/consent before any future transport call.
export const client = {
  track: async (_event: string, _properties?: AnalyticsTrackProperties) => {
    if (!getReadyAnalyticsIdentity()) return;
  }
};

export const trackEvent = async (_request: Omit<TempleSendTrackEventRequest, 'type'>) => {
  if (!getReadyAnalyticsIdentity()) return;
};

export const pageEvent = async (_request: Omit<TempleSendPageEventRequest, 'type'>) => {
  if (!getReadyAnalyticsIdentity()) return;
};
