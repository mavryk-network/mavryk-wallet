import { BalanceMode } from 'app/store/settings/balance-mode.enum';
import { ABTestGroup } from 'lib/apis/temple/ab-test-group.enum';

import { createDestinationStore } from './destination-store';
import { BrowserStorage } from './persist-storage';
import { UI_SCHEMA } from './ui-state.schema';
export type { UIState } from './ui-state.schema';

/** Background-owned preferences destination. null ID means unadopted; initialization never generates an ID. */
export function createUIStore(storage?: BrowserStorage) {
  return createDestinationStore({
    name: 'zustand-ui',
    storage,
    delay: 0,
    schema: UI_SCHEMA,
    defaults: {
      shouldShowNewsletterModal: true,
      userId: null,
      isAnalyticsEnabled: false,
      balanceMode: BalanceMode.Fiat,
      isOnRampPossibility: false,
      abTestGroupName: ABTestGroup.Unknown,
      shouldShowPromotion: false,
      promotionHidingTimestamps: {},
      isNewsEnabled: true,
      legacyMigrated: false,
      legacyAssetsMigrated: false
    },
    actions: update => ({
      setShouldShowNewsletterModal: (value: boolean) =>
        update(draft => {
          draft.shouldShowNewsletterModal = value;
        }),
      setUserId: (value: string) =>
        update(draft => {
          draft.userId = value;
        }),
      setAnalyticsEnabled: (value: boolean) =>
        update(draft => {
          draft.isAnalyticsEnabled = value;
        }),
      setBalanceMode: (value: BalanceMode) =>
        update(draft => {
          draft.balanceMode = value;
        }),
      setOnRampPossibility: (value: boolean) =>
        update(draft => {
          draft.isOnRampPossibility = value;
        }),
      setAbTestGroupName: (value: ABTestGroup) =>
        update(draft => {
          draft.abTestGroupName = value;
        }),
      setLastSeenPromotionName: (value: string | undefined) =>
        update(draft => {
          draft.lastSeenPromotionName = value;
        }),
      setShouldShowPromotion: (value: boolean) =>
        update(draft => {
          draft.shouldShowPromotion = value;
        }),
      setPromotionHidingTimestamps: (value: Record<string, number>) =>
        update(draft => {
          draft.promotionHidingTimestamps = value;
        }),
      setIsNewsEnabled: (value: boolean) =>
        update(draft => {
          draft.isNewsEnabled = value;
        })
    })
  });
}

export const uiStore = createUIStore();
