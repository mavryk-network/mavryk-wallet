import { nanoid } from '@reduxjs/toolkit';
import { createStore, useStore } from 'zustand';
import { persist } from 'zustand/middleware';

import { ABTestGroup } from 'lib/apis/temple';
import { AD_HIDING_TIMEOUT } from 'lib/constants';

import { browserStorage } from './persist-storage';

/**
 * UI state store — replaces simple Redux slices for app-level UI flags.
 *
 * Migrated slices:
 * - newsletter (shouldShowNewsletterModal)
 * - settings (userId, isAnalyticsEnabled, balanceMode, isOnRampPossibility)
 * - abTesting (abTestGroupName)
 * - partnersPromotion (shouldShowPromotion, promotionHidingTimestamps)
 * - notifications (isNewsEnabled)
 *
 * Persisted to browser.storage.local via Zustand persist middleware.
 */

export enum BalanceMode {
  Fiat = 'fiat',
  Gas = 'gas'
}

export interface UIState {
  // Newsletter
  shouldShowNewsletterModal: boolean;

  // Settings (app-level, NOT wallet settings from TempleSettings)
  userId: string;
  isAnalyticsEnabled: boolean;
  balanceMode: BalanceMode;
  isOnRampPossibility: boolean;

  // AB Testing
  abTestGroupName: ABTestGroup;

  // Advertising
  lastSeenPromotionName?: string;

  // Partners Promotion
  shouldShowPromotion: boolean;
  promotionHidingTimestamps: Record<string, number>;

  // Notifications
  isNewsEnabled: boolean;
}

interface UIActions {
  setShouldShowNewsletterModal: (show: boolean) => void;
  setUserId: (id: string) => void;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setBalanceMode: (mode: BalanceMode) => void;
  setOnRampPossibility: (possible: boolean) => void;
  setAbTestGroupName: (group: ABTestGroup) => void;
  setLastSeenPromotionName: (name: string | undefined) => void;
  togglePartnersPromotion: (show: boolean) => void;
  hidePromotion: (id: string, timestamp: number) => void;
  setIsNewsEnabled: (enabled: boolean) => void;
}

export type UIStore = UIState & UIActions;

export const uiStore = createStore<UIStore>()(
  persist(
    (set) => ({
      // Newsletter
      shouldShowNewsletterModal: true,

      // Settings
      userId: nanoid(),
      isAnalyticsEnabled: true,
      balanceMode: BalanceMode.Fiat,
      isOnRampPossibility: false,

      // AB Testing
      abTestGroupName: ABTestGroup.Unknown,

      // Advertising
      lastSeenPromotionName: undefined,

      // Partners Promotion
      shouldShowPromotion: false,
      promotionHidingTimestamps: {},

      // Notifications
      isNewsEnabled: true,

      // Actions
      setShouldShowNewsletterModal: (show) => set({ shouldShowNewsletterModal: show }),
      setUserId: (id) => set({ userId: id }),
      setAnalyticsEnabled: (enabled) => set({ isAnalyticsEnabled: enabled }),
      setBalanceMode: (mode) => set({ balanceMode: mode }),
      setOnRampPossibility: (possible) => set({ isOnRampPossibility: possible }),
      setAbTestGroupName: (group) => set({ abTestGroupName: group }),
      setLastSeenPromotionName: (name) => set({ lastSeenPromotionName: name }),
      togglePartnersPromotion: (show) => set({ shouldShowPromotion: show, promotionHidingTimestamps: {} }),
      hidePromotion: (id, timestamp) => set((state) => {
        const cleaned: Record<string, number> = {};
        for (const key in state.promotionHidingTimestamps) {
          if (state.promotionHidingTimestamps[key] >= timestamp - AD_HIDING_TIMEOUT * 2) {
            cleaned[key] = state.promotionHidingTimestamps[key];
          }
        }
        cleaned[id] = timestamp;
        return { promotionHidingTimestamps: cleaned };
      }),
      setIsNewsEnabled: (enabled) => set({ isNewsEnabled: enabled })
    }),
    {
      name: 'zustand-ui',
      storage: {
        getItem: async (name) => {
          const value = await browserStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await browserStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await browserStorage.removeItem(name);
        }
      },
      // Only persist state, not actions
      partialize: (state) => ({
        shouldShowNewsletterModal: state.shouldShowNewsletterModal,
        userId: state.userId,
        isAnalyticsEnabled: state.isAnalyticsEnabled,
        balanceMode: state.balanceMode,
        isOnRampPossibility: state.isOnRampPossibility,
        abTestGroupName: state.abTestGroupName,
        lastSeenPromotionName: state.lastSeenPromotionName,
        shouldShowPromotion: state.shouldShowPromotion,
        promotionHidingTimestamps: state.promotionHidingTimestamps,
        isNewsEnabled: state.isNewsEnabled
      }) as unknown as UIStore
    }
  )
);

// Typed selector hook
export const useUIStore = <T>(selector: (state: UIStore) => T): T =>
  useStore(uiStore, selector);

// Convenience selectors
export const useShouldShowNewsletterModal = () => useUIStore(s => s.shouldShowNewsletterModal);
export const useUserId = () => useUIStore(s => s.userId);
export const useIsAnalyticsEnabled = () => useUIStore(s => s.isAnalyticsEnabled);
export const useBalanceMode = () => useUIStore(s => s.balanceMode);
export const useIsOnRampPossibility = () => useUIStore(s => s.isOnRampPossibility);
export const useAbTestGroupName = () => useUIStore(s => s.abTestGroupName);
export const useLastSeenPromotionName = () => useUIStore(s => s.lastSeenPromotionName);
export const useShouldShowPromotion = () => useUIStore(s => s.shouldShowPromotion);
export const usePromotionHidingTimestamp = (id: string) => useUIStore(s => s.promotionHidingTimestamps[id] ?? 0);
export const useIsNewsEnabled = () => useUIStore(s => s.isNewsEnabled);
