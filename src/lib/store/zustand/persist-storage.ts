import browser from 'webextension-polyfill';

export interface BrowserStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

/** No remove operation: migration destinations cannot delete legacy data through this adapter. */
export const BROWSER_STORAGE: BrowserStorage = {
  get: key => browser.storage.local.get(key),
  set: items => browser.storage.local.set(items)
};
