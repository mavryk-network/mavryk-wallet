import browser from 'webextension-polyfill';

/** Firefox 140+ built-in data consent category, declared as optional in the manifest. */
export const FIREFOX_ANALYTICS_DATA_COLLECTION = {
  data_collection: ['technicalAndInteraction']
} as unknown as browser.Permissions.Permissions;

/**
 * Shows Firefox's own data consent prompt; other browsers rely on the in-app opt-in only.
 * Must be called directly from a user gesture. Never throws: a refusal just keeps analytics off in the background.
 */
export async function requestBrowserAnalyticsConsent() {
  if (process.env.TARGET_BROWSER !== 'firefox') return true;

  try {
    return await browser.permissions.request(FIREFOX_ANALYTICS_DATA_COLLECTION);
  } catch {
    return false;
  }
}

/** Fails closed on Firefox when the browser-level data consent is missing or the API is unavailable. */
export async function hasBrowserAnalyticsConsent() {
  if (process.env.TARGET_BROWSER !== 'firefox') return true;

  try {
    return await browser.permissions.contains(FIREFOX_ANALYTICS_DATA_COLLECTION);
  } catch {
    return false;
  }
}
