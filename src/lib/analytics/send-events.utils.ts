import { getOwnedUISnapshot, updateOwnedUI } from 'lib/store/zustand/ui-client';
import { AnalyticsEventCategory } from 'lib/temple/analytics-types';
import { assertResponse, request } from 'lib/temple/front/client';
import { TempleMessageType } from 'lib/temple/types';

import type { AnalyticsEventProperties, ForegroundAnalyticsEventName } from './analytics-events.schema';

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

/**
 * Fire-and-forget product event from an extension page. The background re-checks consent and the event whitelist,
 * so this never sends anything for opted-out users and never throws into UI flows.
 */
export const trackAnalyticsEvent = <E extends ForegroundAnalyticsEventName>(
  event: E,
  properties: AnalyticsEventProperties<E>
) => {
  sendTrackEvent('', undefined, event, AnalyticsEventCategory.General, properties).catch(() => undefined);
};

/**
 * Saves the analytics consent through the background owner (the same command `setIsAnalyticsEnabledAction` maps to)
 * and resolves once it is durable, so an event sent afterwards is not dropped. Saving errors are shown by the shared
 * readiness gate, so they are not rethrown here.
 */
export const setAnalyticsConsent = (isAnalyticsEnabled: boolean) =>
  updateOwnedUI({ kind: 'preferences', values: { isAnalyticsEnabled } }).catch(() => undefined);
