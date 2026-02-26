import type { StateStorage } from 'zustand/middleware';
import browser from 'webextension-polyfill';

/**
 * Zustand persist storage adapter for browser.storage.local.
 * Drop-in replacement for the Redux Persist storage adapter.
 */
export const browserStorage: StateStorage = {
  getItem: async (key: string) => {
    const records = await browser.storage.local.get(key);
    const value = records[key] ?? null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  },

  setItem: async (key: string, value: string) => {
    await browser.storage.local.set({ [key]: value });
  },

  removeItem: async (key: string) => {
    await browser.storage.local.remove(key);
  }
};
