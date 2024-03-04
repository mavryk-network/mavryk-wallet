import { nanoid } from 'nanoid';

import { TEMPLE_WALLET_AD_ATTRIBUTE_NAME } from 'lib/constants';

import { HypelabAdsResolution, HypelabNativeAdsResolution } from './ads-resolutions';
import { getHypelabIframeUrl } from './get-hypelab-iframe-url';

export const makeHypelabAdElement = (
  adsResolution: HypelabAdsResolution | HypelabNativeAdsResolution,
  elementStyle: Record<string, string>
) => {
  const { width, height, placementType } = adsResolution;

  const iframe = document.createElement('iframe');
  iframe.id = nanoid();
  iframe.src = getHypelabIframeUrl(placementType, window.location.href, width, height);
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  iframe.style.border = 'none';
  for (const styleProp in elementStyle) {
    iframe.style.setProperty(styleProp, elementStyle[styleProp]);
  }
  iframe.setAttribute(TEMPLE_WALLET_AD_ATTRIBUTE_NAME, 'true');

  return iframe;
};
