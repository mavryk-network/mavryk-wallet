import { getOwnedUISnapshot } from 'lib/store/zustand/ui-client';
import { AnalyticsEventCategory } from 'lib/temple/analytics-types';
import { assertResponse, request } from 'lib/temple/front/client';
import { TempleMessageType } from 'lib/temple/types';

export const sendTrackEvent = async (
  _userId: string,
  rpc: string | undefined,
  event: string,
  category: AnalyticsEventCategory = AnalyticsEventCategory.General,
  properties?: object
) => {
  const { ui } = getOwnedUISnapshot();
  if (!ui.legacyMigrated || !ui.isAnalyticsEnabled || !ui.userId) return;
  const res = await request({
    type: TempleMessageType.SendTrackEventRequest,
    userId: ui.userId,
    rpc,
    event,
    category,
    properties
  });
  assertResponse(res.type === TempleMessageType.SendTrackEventResponse);
};

export const sendPageEvent = async (
  _userId: string,
  rpc: string | undefined,
  path: string,
  search: string,
  additionalProperties = {}
) => {
  const { ui } = getOwnedUISnapshot();
  if (!ui.legacyMigrated || !ui.isAnalyticsEnabled || !ui.userId) return;
  const res = await request({
    type: TempleMessageType.SendPageEventRequest,
    userId: ui.userId,
    rpc,
    path,
    search,
    additionalProperties
  });
  assertResponse(res.type === TempleMessageType.SendPageEventResponse);
};
