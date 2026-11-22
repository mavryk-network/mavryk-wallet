/**
 * Minimal PostHog capture transport for the background script.
 * No SDK: MV3 forbids remote code and the wallet needs no autocapture, replay, surveys or feature flags.
 * See https://posthog.com/docs/api/capture
 */

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

// Unit tests load local `.env` files; they must never reach a real project.
const POSTHOG_KEY = process.env.NODE_ENV === 'test' ? '' : (process.env.POSTHOG_KEY ?? '').trim();
const POSTHOG_HOST = ((process.env.POSTHOG_HOST ?? '').trim() || DEFAULT_POSTHOG_HOST).replace(/\/+$/, '');

/** Builds without a project key never send anything. */
export const isPostHogConfigured = () => POSTHOG_KEY.length > 0;

interface PostHogCaptureInput {
  event: string;
  distinctId: string;
  properties: Record<string, unknown>;
}

/**
 * Sends one event to the PostHog capture endpoint.
 * Person profiles are disabled: events stay anonymous and are linked only by the random install id.
 */
export async function capturePostHogEvent({ event, distinctId, properties }: PostHogCaptureInput) {
  if (!isPostHogConfigured()) return;

  const response = await fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    body: JSON.stringify({
      api_key: POSTHOG_KEY,
      event,
      distinct_id: distinctId,
      timestamp: new Date().toISOString(),
      properties: {
        ...properties,
        distinct_id: distinctId,
        $process_person_profile: false,
        $lib: 'mavryk-wallet-extension'
      }
    })
  });

  if (!response.ok) throw new Error(`PostHog capture failed with status ${response.status}`);
}
