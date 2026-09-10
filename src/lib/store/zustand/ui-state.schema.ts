import { z } from 'zod';

import { BalanceMode } from 'app/store/settings/balance-mode.enum';
import { ABTestGroup } from 'lib/apis/temple/ab-test-group.enum';

import { SAFE_KEY_SCHEMA } from './validation';

export const UI_SCHEMA = z.object({
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
  isNewsEnabled: z.boolean(),
  legacyMigrated: z.boolean().default(false)
});

export type UIState = z.infer<typeof UI_SCHEMA>;

export const UI_PREFERENCES_SCHEMA = UI_SCHEMA.pick({
  isAnalyticsEnabled: true,
  balanceMode: true,
  isOnRampPossibility: true,
  abTestGroupName: true,
  shouldShowNewsletterModal: true,
  isNewsEnabled: true,
  lastSeenPromotionName: true
}).partial();
export type UIPreferences = z.infer<typeof UI_PREFERENCES_SCHEMA>;
