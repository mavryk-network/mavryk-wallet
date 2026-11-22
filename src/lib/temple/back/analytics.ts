import browser from 'webextension-polyfill';

import {
  AnalyticsEventName,
  AnalyticsEventProperties,
  AnalyticsTxSource,
  isForegroundAnalyticsEvent,
  parseAnalyticsEventProperties
} from 'lib/analytics/analytics-events.schema';
import {
  AnalyticsOperationKind,
  toAnalyticsErrorCode,
  toAnalyticsNetwork,
  toAnalyticsNetworkFromRpc
} from 'lib/analytics/analytics.helpers';
import { hasBrowserAnalyticsConsent } from 'lib/analytics/browser-consent';
import { capturePostHogEvent, isPostHogConfigured } from 'lib/analytics/posthog.client';
import { waitForAnalyticsIdentity } from 'lib/store/zustand/ui-owner';
import { TempleSendPageEventRequest, TempleSendTrackEventRequest } from 'lib/temple/analytics-types';
import { NETWORK_ID_STORAGE_KEY, normalizeNetworkId } from 'lib/temple/network-storage';

const ENVIRONMENT = (process.env.POSTHOG_ENVIRONMENT ?? '').trim() || process.env.NODE_ENV || 'production';

interface TrackOptions {
  /** RPC the event happened on; overrides the selected network (dApps may use another one). */
  networkRpc?: string;
}

async function getSelectedNetworkId() {
  const items = await browser.storage.local.get(NETWORK_ID_STORAGE_KEY);
  const networkId: unknown = items[NETWORK_ID_STORAGE_KEY];

  return typeof networkId === 'string' ? networkId : null;
}

/**
 * Single analytics entry point: no-op unless a PostHog key is configured, the user opted in and the event matches
 * the whitelist. Super properties carry no personal data. Never throws, so callers can fire and forget.
 */
export async function trackBackgroundEvent<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEventProperties<E>,
  { networkRpc }: TrackOptions = {}
) {
  try {
    if (!isPostHogConfigured()) return;

    const parsedProperties = parseAnalyticsEventProperties(event, properties);
    if (!parsedProperties) return;

    const distinctId = await waitForAnalyticsIdentity();
    if (!distinctId || !(await hasBrowserAnalyticsConsent())) return;

    const network = networkRpc
      ? toAnalyticsNetworkFromRpc(networkRpc)
      : toAnalyticsNetwork(await getSelectedNetworkId());

    await capturePostHogEvent({
      event,
      distinctId,
      properties: {
        ...parsedProperties,
        extension_version: process.env.VERSION,
        browser: process.env.TARGET_BROWSER,
        environment: ENVIRONMENT,
        network
      }
    });
  } catch {
    // Analytics must never affect wallet flows; failures are dropped without logging payloads.
  }
}

/** Reports a failed or rejected operation; a decline by the user (or a dApp prompt timeout) is a rejection. */
export function trackOperationError(
  error: unknown,
  { tx_type }: AnalyticsOperationKind,
  source: AnalyticsTxSource,
  networkRpc: string,
  isRejection: boolean
) {
  void (isRejection
    ? trackBackgroundEvent('tx_rejected', { tx_type, source }, { networkRpc })
    : trackBackgroundEvent('tx_failed', { tx_type, source, error_code: toAnalyticsErrorCode(error) }, { networkRpc }));
}

/** Emits `network_switched` when the selected network changes; legacy id normalization is not a switch. */
export function startNetworkSwitchTracking() {
  browser.storage.onChanged.addListener((changes, area) => {
    const change = area === 'local' ? changes[NETWORK_ID_STORAGE_KEY] : undefined;
    if (!change || typeof change.newValue !== 'string' || typeof change.oldValue !== 'string') return;
    if (normalizeNetworkId(change.oldValue) === normalizeNetworkId(change.newValue)) return;

    void trackBackgroundEvent('network_switched', { network: toAnalyticsNetwork(change.newValue) });
  });
}

/** Extension pages may request only foreground events; properties are re-validated against the whitelist. */
export const trackEvent = async ({ event, properties }: Omit<TempleSendTrackEventRequest, 'type'>) => {
  if (!isForegroundAnalyticsEvent(event)) return;

  void trackBackgroundEvent(event, properties as AnalyticsEventProperties<typeof event>);
};

/** Page views are intentionally not collected. */
export const pageEvent = async (_request: Omit<TempleSendPageEventRequest, 'type'>) => undefined;
