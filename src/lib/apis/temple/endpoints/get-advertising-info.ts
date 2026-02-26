import { from } from 'rxjs';
import { map } from 'rxjs/operators';

import { templeWalletApi } from './templewallet.api';

export interface AdvertisingPromotion {
  name: string;
  url: string;
  fullPageBannerUrl: string;
  fullPageLogoUrl: string;
  popupBannerUrl: string;
  popupLogoUrl: string;
  mobileBannerUrl: string;
}

interface GetAdvertisingInfoResponse {
  data?: AdvertisingPromotion;
}

export const getAdvertisingInfo$ = () =>
  from(templeWalletApi.get<GetAdvertisingInfoResponse>('/advertising-info')).pipe(map(response => response.data.data));

export const fetchAdvertisingInfo = async (): Promise<AdvertisingPromotion | undefined> => {
  try {
    const response = await templeWalletApi.get<GetAdvertisingInfoResponse>('/advertising-info');
    return response.data.data;
  } catch {
    return undefined;
  }
};
