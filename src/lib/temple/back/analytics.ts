import { TempleSendPageEventRequest, TempleSendTrackEventRequest } from 'lib/temple/analytics-types';
type AnalyticsTrackProperties = Record<string, unknown>;

export const client = {
  track: async (_event: string, _properties?: AnalyticsTrackProperties) => undefined
};

export const trackEvent = async ({
  userId: _userId,
  rpc: _rpc,
  event: _event,
  category: _category,
  properties: _properties
}: Omit<TempleSendTrackEventRequest, 'type'>) => undefined;

export const pageEvent = async ({
  userId: _userId,
  rpc: _rpc,
  path: _path,
  search: _search,
  additionalProperties: _additionalProperties
}: Omit<TempleSendPageEventRequest, 'type'>) => undefined;
