import { advertisingPromotionMock } from 'app/interfaces/advertising-promotion.mock';
import { createEntity } from 'lib/store';

import { AdvertisingState } from './state';
import { advertisingPromotionMock } from '../../interfaces/advertising-promotion.mock';

export const mockAdvertisingState: AdvertisingState = {
  activePromotion: createEntity(advertisingPromotionMock)
};
