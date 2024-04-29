import { isDefined } from '@rnw-community/shared';

import { CollectibleDetails } from 'app/store/collectibles/state';
import { objktCurrencies } from 'lib/apis/objkt';

export function getDetailsListing(details: CollectibleDetails | nullish) {
  if (!details?.listing) return null;

  const { floorPrice, currencyId } = details.listing;

  const currency = objktCurrencies[currencyId];

  if (!isDefined(currency)) return null;

  return { floorPrice, decimals: currency.decimals, symbol: currency.symbol };
}
