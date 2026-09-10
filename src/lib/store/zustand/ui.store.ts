import { z } from 'zod';

import { BalanceMode } from 'app/store/settings/balance-mode.enum';
import { ABTestGroup } from 'lib/apis/temple/ab-test-group.enum';

import { createDestinationStore } from './destination-store';
import { BrowserStorage } from './persist-storage';
import { SAFE_KEY_SCHEMA } from './validation';

const UI_SCHEMA = z.object({
  shouldShowNewsletterModal: z.boolean(),
  userId: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[A-Za-z0-9_-]+$/)
    .nullable(),
  isAnalyticsEnabled: z.boolean(),
  balanceMode: z.nativeEnum(BalanceMode),
  isOnRampPossibility: z.boolean(),
  abTestGroupName: z.nativeEnum(ABTestGroup),
  lastSeenPromotionName: z.string().max(512).optional(),
  shouldShowPromotion: z.boolean(),
  promotionHidingTimestamps: z.record(SAFE_KEY_SCHEMA, z.number().finite()),
  isNewsEnabled: z.boolean()
});

export type UIState = z.infer<typeof UI_SCHEMA>;

/** Inactive preferences destination. null ID means unadopted; initialization never generates an ID. */
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
      isNewsEnabled: true
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
