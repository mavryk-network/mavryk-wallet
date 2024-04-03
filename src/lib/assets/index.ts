import BigNumber from 'bignumber.js';

import type { AssetMetadataBase } from 'lib/metadata';

import { Asset, FA2Token } from './types';

export const MAV_TOKEN_SLUG = 'mav' as const;
export const TEMPLE_TOKEN_SLUG = 'KT1VaEsVNiBoA56eToEK6n6BcPgh1tdx9eXi_0';
export const TZBTC_TOKEN_SLUG = 'KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn_0';

export const toTokenSlug = (contract: string, id: BigNumber.Value = 0) => {
  return `${contract}_${new BigNumber(id).toFixed()}`;
};

export const tokenToSlug = <T extends { address: string; id?: BigNumber.Value }>({ address, id }: T) => {
  return toTokenSlug(address, id);
};

export const isFA2Token = (asset: Asset): asset is FA2Token =>
  isTezAsset(asset) ? false : typeof asset.id !== 'undefined';

export const isTezAsset = (asset: Asset | string): asset is typeof MAV_TOKEN_SLUG => asset === MAV_TOKEN_SLUG;

export const isTzbtcAsset = (asset: Asset | string): asset is typeof TZBTC_TOKEN_SLUG => asset === TZBTC_TOKEN_SLUG;

export const toPenny = (metadata: AssetMetadataBase | nullish) => new BigNumber(1).div(10 ** (metadata?.decimals ?? 0));
