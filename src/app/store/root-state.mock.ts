import { mockNotificationsState } from 'lib/notifications';

import { mockABTestingState } from './ab-testing/state.mock';
import { mockAdvertisingState } from './advertising/state.mock';
import { mockAssetsState } from './assets/state.mock';
import { mockBalancesState } from './balances/state.mock';
import { mockBuyWithCreditCardState } from './buy-with-credit-card/state.mock';
import { mockCollectiblesState } from './collectibles/state.mock';
import { mockCollectiblesMetadataState } from './collectibles-metadata/state.mock';
import { mockCurrencyState } from './currency/state.mock';
import { mockDAppsState } from './d-apps/state.mock';
import { mockNewsletterState } from './newsletter/newsletter-state.mock';
import { mockPartnersPromotionState } from './partners-promotion/state.mock';
import type { RootState } from './root-state.type';
import { mockRwasState } from './rwas/state.mock';
import { mockRwasMetadataState } from './rwas-metadata/state.mock';
import { mockSettingsState } from './settings/state.mock';
import { mockSwapState } from './swap/state.mock';
import { mockTokensMetadataState } from './tokens-metadata/state.mock';

// ts-prune-ignore-next
export const mockRootState: RootState = {
  settings: mockSettingsState,
  advertising: mockAdvertisingState,
  currency: mockCurrencyState,
  notifications: mockNotificationsState,
  dApps: mockDAppsState,
  swap: mockSwapState,
  partnersPromotion: mockPartnersPromotionState,
  balances: mockBalancesState,
  assets: mockAssetsState,
  tokensMetadata: mockTokensMetadataState,
  collectiblesMetadata: mockCollectiblesMetadataState,
  rwasMetadata: mockRwasMetadataState,
  abTesting: mockABTestingState,
  buyWithCreditCard: mockBuyWithCreditCardState,
  collectibles: mockCollectiblesState,
  rwas: mockRwasState,
  newsletter: mockNewsletterState
};
