import { isDefined } from '@rnw-community/shared';

import { objktCurrencies } from 'lib/apis/objkt';
import type { CollectibleDetails } from 'lib/collectibles/types';

export function getDetailsListing(details: CollectibleDetails | nullish) {
  if (!details?.listing) return null;

  const { floorPrice, currencyId } = details.listing;

  const currency = objktCurrencies[currencyId];

  if (!isDefined(currency)) return null;

  return { floorPrice, decimals: currency.decimals, symbol: currency.symbol };
}
