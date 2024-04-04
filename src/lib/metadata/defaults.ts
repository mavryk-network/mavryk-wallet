import browser from 'webextension-polyfill';

import type { AssetMetadataBase } from './types';

export const MAVEN_METADATA: AssetMetadataBase = {
  decimals: 6,
  symbol: 'MVRK',
  name: 'Mavryk',
  thumbnailUri: browser.runtime.getURL('misc/token-logos/mvrk.svg')
};

export const FILM_METADATA: AssetMetadataBase = {
  decimals: 6,
  symbol: 'FILM',
  name: 'FILM',
  thumbnailUri: browser.runtime.getURL('misc/token-logos/film.png')
};

export const EMPTY_BASE_METADATA: AssetMetadataBase = {
  decimals: 0,
  symbol: '',
  name: '',
  thumbnailUri: ''
};
